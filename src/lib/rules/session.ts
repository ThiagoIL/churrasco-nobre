// Validade de sessão: 12 horas no total e 120 minutos sem uso.
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 120 * 60 * 1000;
/** A última atividade só é regravada se passou deste tempo (evita uma escrita por requisição). */
export const SESSION_TOUCH_MS = 60 * 1000;

export type SessionRow = { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null };
export type SessionState = "ok" | "revoked" | "expired" | "idle";

export function sessionState(session: SessionRow, now: Date): SessionState {
  if (session.revokedAt) return "revoked";
  if (session.expiresAt.getTime() <= now.getTime()) return "expired";
  if (now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS) return "idle";
  return "ok";
}

export const needsTouch = (session: Pick<SessionRow, "lastSeenAt">, now: Date) =>
  now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_MS;

export const newExpiry = (now: Date) => new Date(now.getTime() + SESSION_TTL_MS);
