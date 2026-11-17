// Leitura das sessões no banco. Sem "server-only" porque o proxy (runtime Node) também usa.
// O token do cookie nunca é gravado: o banco guarda só o SHA-256.
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { needsTouch, sessionState } from "@/lib/rules/session";
import { parsePermissions, type Permissions, type Role } from "@/lib/modules";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  permissions: Permissions;
};
export type LoadedSession = { sessionId: string; user: SessionUser };

/** Sessão válida (não revogada, dentro das 12 h e do limite de inatividade, usuário ativo) ou null. */
export async function loadUserSession(token: string | null | undefined, now = new Date()): Promise<LoadedSession | null> {
  if (!token || token.length > 128) return null;
  const s = await db.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, role: true, active: true, mustChangePassword: true,
          accessProfile: { select: { permissions: true } },
        },
      },
    },
  });
  if (!s || sessionState(s, now) !== "ok" || !s.user.active) return null;
  if (needsTouch(s, now)) {
    await db.userSession.update({ where: { id: s.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  const { accessProfile, ...user } = s.user;
  return { sessionId: s.id, user: { ...user, permissions: parsePermissions(accessProfile?.permissions) } };
}

export type PlatformSessionAdmin = { id: string; name: string; email: string; isMaster: boolean; mustChangePassword: boolean };
export type LoadedPlatformSession = { sessionId: string; admin: PlatformSessionAdmin };

export async function loadPlatformSession(token: string | null | undefined, now = new Date()): Promise<LoadedPlatformSession | null> {
  if (!token || token.length > 128) return null;
  const s = await db.platformSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: { select: { id: true, name: true, email: true, isMaster: true, active: true, mustChangePassword: true } } },
  });
  if (!s || sessionState(s, now) !== "ok" || !s.admin.active) return null;
  if (needsTouch(s, now)) {
    await db.platformSession.update({ where: { id: s.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  const { active: _active, ...admin } = s.admin;
  return { sessionId: s.id, admin };
}
