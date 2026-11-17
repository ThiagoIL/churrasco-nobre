import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, newToken } from "@/lib/crypto";
import { PLATFORM_COOKIE, cookieOptions } from "@/lib/cookies";
import { verifyPassword } from "@/lib/passwords";
import { withinLimit } from "@/lib/rate-limit";
import { requestInfo } from "@/lib/request-info";
import { auditSafe } from "@/lib/audit";
import { clearedAttempts, isLocked, registerFailure } from "@/lib/rules/lockout";
import { SESSION_TTL_MS, newExpiry } from "@/lib/rules/session";
import { loadPlatformSession, type LoadedPlatformSession, type PlatformSessionAdmin } from "@/lib/session-store";
import { PLATFORM_BASE_HEADER } from "@/lib/platform-config";
import { LOGIN_ERROR, TOO_MANY_ERROR } from "@/lib/auth";

/**
 * Prefixo do console na requisição atual: "" (domínio dedicado) ou ex.: "/sistema-admin".
 * Vem de um header que o proxy sempre define; valores estranhos são descartados.
 */
export async function getPlatformBase(): Promise<string> {
  const value = (await headers()).get(PLATFORM_BASE_HEADER) ?? "";
  return /^\/[A-Za-z0-9/_-]*$/.test(value) && !value.startsWith("//") ? value : "";
}

export async function startPlatformSession(adminId: string): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  const token = newToken();
  await db.platformSession.create({
    data: { adminId, tokenHash: hashToken(token), expiresAt: newExpiry(new Date()), ip, userAgent },
  });
  (await cookies()).set(PLATFORM_COOKIE, token, cookieOptions(SESSION_TTL_MS / 1000));
}

export async function endPlatformSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PLATFORM_COOKIE)?.value;
  if (token) {
    await db.platformSession
      .updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  jar.set(PLATFORM_COOKIE, "", cookieOptions(0));
}

export const getPlatformSession = cache(async (): Promise<LoadedPlatformSession | null> => {
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  return loadPlatformSession(token);
});

export type CurrentAdmin = PlatformSessionAdmin & { sessionId: string };

export async function requirePlatformAdmin(options: { allowPasswordChange?: boolean } = {}): Promise<CurrentAdmin> {
  const session = await getPlatformSession();
  const base = await getPlatformBase();
  if (!session) redirect(`${base}/login`);
  if (session.admin.mustChangePassword && !options.allowPasswordChange) redirect(`${base}/conta`);
  return { ...session.admin, sessionId: session.sessionId };
}

/** Registra um evento no histórico do console. */
export async function recordPlatformEvent(
  admin: { id: string; name: string },
  action: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await db.platformEvent.create({
    data: {
      adminId: admin.id,
      adminName: admin.name,
      action,
      message,
      data: data ? (JSON.parse(JSON.stringify(data)) as object) : undefined,
    },
  });
}

export type PlatformLoginResult = { ok: true } | { ok: false; error: string };

/** Mesmas defesas do login do sistema: erro genérico, hash fictício, limite no banco e bloqueio de 15 min. */
export async function attemptPlatformLogin(emailRaw: string, password: string): Promise<PlatformLoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const { ip } = await requestInfo();

  const allowed =
    (await withinLimit(`plat:ip:${ip}`, 20, 15 * 60)) && (await withinLimit(`plat:conta:${email}`, 10, 15 * 60));
  if (!allowed) {
    await auditSafe({ action: "auth.login_falhou", entity: "console", actor: email, data: { motivo: "limite_de_tentativas" } });
    return { ok: false, error: TOO_MANY_ERROR };
  }

  const admin = await db.platformAdmin.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, admin?.passwordHash);
  const now = new Date();

  if (!admin || !admin.active) {
    await auditSafe({ action: "auth.login_falhou", entity: "console", actor: email, data: { motivo: admin ? "inativo" : "desconhecido" } });
    return { ok: false, error: LOGIN_ERROR };
  }

  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM platform_admins WHERE id = ${admin.id}::uuid FOR UPDATE`;
    const fresh = await tx.platformAdmin.findUniqueOrThrow({ where: { id: admin.id }, select: { failedAttempts: true, lockedUntil: true } });
    if (isLocked(fresh, now)) return "locked" as const;
    if (!passwordOk) {
      const next = registerFailure(fresh, now);
      await tx.platformAdmin.update({ where: { id: admin.id }, data: next });
      return "wrong" as const;
    }
    await tx.platformAdmin.update({ where: { id: admin.id }, data: { ...clearedAttempts, lastLoginAt: now } });
    return "ok" as const;
  });

  if (outcome !== "ok") {
    await auditSafe({ action: "auth.login_falhou", entity: "console", actor: email, data: { motivo: outcome } });
    return { ok: false, error: LOGIN_ERROR };
  }

  await startPlatformSession(admin.id);
  await auditSafe({ action: "auth.login", entity: "console", actor: email });
  return { ok: true };
}
