import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const COST = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, COST);

// Hash fictício com o mesmo custo: usuário inexistente gasta o mesmo tempo que um existente.
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= bcrypt.hash("senha-ficticia-para-igualar-o-tempo", COST));

/** Confere a senha. Sem hash (usuário inexistente), compara com o hash fictício e sempre devolve false. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? (await dummyHash()));
  return !!hash && ok;
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGIT = "23456789";

/** Senha provisória de 12 caracteres (sem letras ambíguas), que atende à política de senha. */
export function generateTempPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(UPPER), pick(UPPER), pick(LOWER), pick(LOWER), pick(LOWER), pick(LOWER), pick(DIGIT), pick(DIGIT)];
  const all = UPPER + LOWER + DIGIT;
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
