// Política de senha: 10+ caracteres, com maiúscula, minúscula e número (e no máximo 72 bytes: limite do bcrypt).
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX_BYTES = 72;

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN) problems.push(`ter pelo menos ${PASSWORD_MIN} caracteres`);
  if (!/\p{Ll}/u.test(password)) problems.push("ter uma letra minúscula");
  if (!/\p{Lu}/u.test(password)) problems.push("ter uma letra maiúscula");
  if (!/\d/.test(password)) problems.push("ter um número");
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) problems.push(`ter no máximo ${PASSWORD_MAX_BYTES} bytes`);
  return problems;
}

/** Mensagem pronta para o formulário, ou null quando a senha é válida. */
export function passwordError(password: string): string | null {
  const problems = passwordProblems(password);
  return problems.length ? `A senha precisa ${problems.join(", ")}.` : null;
}
