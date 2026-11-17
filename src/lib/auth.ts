import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, newToken } from "@/lib/crypto";
import { SESSION_COOKIE, cookieOptions } from "@/lib/cookies";
import { verifyPassword } from "@/lib/passwords";
import { withinLimit } from "@/lib/rate-limit";
import { requestInfo } from "@/lib/request-info";
import { auditSafe } from "@/lib/audit";
import { clearedAttempts, isLocked, registerFailure } from "@/lib/rules/lockout";
import { SESSION_TTL_MS, newExpiry } from "@/lib/rules/session";
import { loadSettings, hasAccess, levelOf, type AccessView } from "@/lib/access";
import { loadUserSession, type LoadedSession, type SessionUser } from "@/lib/session-store";
import { MODULE_KEYS, type Access, type Level, type ModuleKey } from "@/lib/modules";

export const LOGIN_ERROR =
  "E-mail ou senha incorretos. Depois de 5 erros seguidos, o acesso fica bloqueado por 15 minutos.";
export const TOO_MANY_ERROR = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

// ───────────────────────── sessão ─────────────────────────

/** Cria a sessão (token aleatório de 256 bits; no banco só o SHA-256) e grava o cookie. */
export async function startSession(userId: string): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  const token = newToken();
  await db.userSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: newExpiry(new Date()), ip, userAgent },
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS / 1000));
  // limpeza ocasional de sessões antigas
  if (Math.random() < 0.05) {
    await db.userSession
      .deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }, { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }] } })
      .catch(() => undefined);
  }
}

/** Revoga a sessão atual e apaga o cookie (com os mesmos atributos do __Host-, para o navegador aceitar). */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.userSession
      .updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  jar.set(SESSION_COOKIE, "", cookieOptions(0));
}

export const getSession = cache(async (): Promise<LoadedSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return loadUserSession(token);
});

export type CurrentUser = SessionUser & { sessionId: string };

/**
 * Usuário logado. Sem sessão vai para o login; com o sistema bloqueado, para a tela de bloqueio;
 * com senha provisória, para a troca de senha (a menos que `allowPasswordChange`).
 */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if ((await loadSettings()).blocked) redirect("/bloqueado");
  if (session.user.mustChangePassword && !options.allowPasswordChange) redirect("/trocar-senha");
  return { ...session.user, sessionId: session.sessionId };
}

/** Acesso do usuário logado (módulos liberados e nível em cada um). Cacheado por requisição. */
export const getAccess = cache(async (): Promise<AccessView & { user: CurrentUser; levels: Record<ModuleKey, Level> }> => {
  const user = await requireUser();
  const settings = await loadSettings();
  const view: AccessView = { user, enabled: settings.enabled };
  const levels = Object.fromEntries(MODULE_KEYS.map((k) => [k, levelOf(view, k)])) as Record<ModuleKey, Level>;
  return { user, enabled: settings.enabled, levels };
});

/** Exige acesso (mínimo `VIEW` por padrão) a um módulo; senão volta ao início. Devolve se pode editar. */
export async function requireModule(module: ModuleKey, minimum: Level = "VIEW") {
  const access = await getAccess();
  if (!hasAccess(access, module, minimum)) redirect("/?acesso=negado");
  return { user: access.user, canEdit: access.levels[module] === "EDIT" };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/?acesso=negado");
  return user;
}

export { hasAccess };
export type { Access };

// ───────────────────────── login ─────────────────────────

export type LoginResult = { ok: true; mustChangePassword: boolean } | { ok: false; error: string };

/**
 * Autentica com e-mail e senha. Erro sempre genérico (não revela se a conta existe), hash fictício
 * para igualar o tempo, limite de tentativas por IP e por conta (no banco) e bloqueio de 15 minutos
 * depois de 5 erros seguidos. Toda tentativa vai para a auditoria.
 */
export async function attemptLogin(emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const { ip } = await requestInfo();

  const allowed =
    (await withinLimit(`login:ip:${ip}`, 30, 15 * 60)) && (await withinLimit(`login:conta:${email}`, 15, 15 * 60));
  if (!allowed) {
    await auditSafe({ action: "auth.login_falhou", entity: "auth", actor: email, data: { motivo: "limite_de_tentativas" } });
    return { ok: false, error: TOO_MANY_ERROR };
  }

  const user = await db.user.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  const now = new Date();

  if (!user || !user.active) {
    await auditSafe({ action: "auth.login_falhou", entity: "auth", actor: email, data: { motivo: user ? "inativo" : "desconhecido" } });
    return { ok: false, error: LOGIN_ERROR };
  }

  // contagem de erros com a linha travada, para tentativas simultâneas não furarem o limite
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { failedAttempts: true, lockedUntil: true } });
    if (isLocked(fresh, now)) return "locked" as const;
    if (!passwordOk) {
      const next = registerFailure(fresh, now);
      await tx.user.update({ where: { id: user.id }, data: next });
      return next.lockedUntil ? ("just_locked" as const) : ("wrong" as const);
    }
    await tx.user.update({ where: { id: user.id }, data: { ...clearedAttempts, lastLoginAt: now } });
    return "ok" as const;
  });

  if (outcome !== "ok") {
    await auditSafe({
      action: "auth.login_falhou", entity: "auth", userId: user.id, actor: email,
      data: { motivo: outcome === "locked" ? "conta_bloqueada" : outcome === "just_locked" ? "bloqueou_apos_5_erros" : "senha_incorreta" },
    });
    return { ok: false, error: LOGIN_ERROR };
  }

  await startSession(user.id);
  await auditSafe({ action: "auth.login", entity: "auth", userId: user.id, actor: email });
  return { ok: true, mustChangePassword: user.mustChangePassword };
}
