// Bloqueio de conta por tentativas de login: 5 erros seguidos bloqueiam por 15 minutos.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type AttemptState = { failedAttempts: number; lockedUntil: Date | null };

export function isLocked(state: Pick<AttemptState, "lockedUntil">, now: Date): boolean {
  return !!state.lockedUntil && state.lockedUntil.getTime() > now.getTime();
}

/** Novo estado após uma senha errada. Ao atingir o limite, bloqueia e zera o contador. */
export function registerFailure(state: AttemptState, now: Date): AttemptState {
  // um bloqueio já vencido recomeça a contagem do zero
  const base = state.lockedUntil && !isLocked(state, now) ? 0 : state.failedAttempts;
  const failed = base + 1;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    return { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { failedAttempts: failed, lockedUntil: null };
}

export const clearedAttempts: AttemptState = { failedAttempts: 0, lockedUntil: null };
