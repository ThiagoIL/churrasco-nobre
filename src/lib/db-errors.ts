// Tradução dos erros do banco para mensagens em português. Sem dependências de servidor (testável).

/** Índices/constraints únicos -> mensagem. A busca é feita no texto do erro. */
const UNIQUE_MESSAGES: [string, string][] = [
  ["items_name_ci", "Já existe um item com este nome."],
  ["items_code_ci", "Já existe um item com este código."],
  ["financial_categories_name_ci", "Já existe uma categoria com este nome."],
  ["financial_categories_kind_name_key", "Já existe uma categoria com este nome."],
  ["payment_methods_name_ci", "Já existe uma forma de pagamento com este nome."],
  ["payment_methods_name_key", "Já existe uma forma de pagamento com este nome."],
  ["dining_tables_name_ci", "Já existe uma mesa ou comanda com este nome."],
  ["dining_tables_name_key", "Já existe uma mesa ou comanda com este nome."],
  ["suppliers_name_ci", "Já existe um fornecedor com este nome."],
  ["suppliers_name_key", "Já existe um fornecedor com este nome."],
  ["access_profiles_name_ci", "Já existe um perfil com este nome."],
  ["access_profiles_name_key", "Já existe um perfil com este nome."],
  ["users_email_key", "Já existe um usuário com este e-mail."],
  ["platform_admins_email_key", "Já existe um administrador com este e-mail."],
];

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error ?? "");
  const e = error as { message?: unknown; meta?: unknown; cause?: unknown };
  let text = String(e.message ?? "");
  try {
    if (e.meta) text += ` ${JSON.stringify(e.meta)}`;
    if (e.cause) text += ` ${errorText(e.cause)}`;
  } catch {
    // ignora estruturas circulares
  }
  return text;
}

/** Mensagem "[regra] ..." levantada por um trigger do banco, se houver. */
export function ruleMessage(error: unknown): string | null {
  const text = errorText(error).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  // a mensagem termina na quebra de linha ou no acento grave que o Prisma usa para fechá-la
  const match = /\[regra\]\s*([^\n`]+)/.exec(text);
  if (!match) return null;
  // remove sobras do formato de depuração do driver (…", detail: None, …)
  return match[1].replace(/",?\s*(detail|hint|position|where_|schema|table|column|datatype|constraint|file|line|routine)\b.*$/s, "").trim();
}

/** Mensagem amigável para erros conhecidos do banco; null quando não reconhece. */
export function friendlyDatabaseError(error: unknown): string | null {
  const rule = ruleMessage(error);
  if (rule) return rule;

  const text = errorText(error);
  const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;

  if (code === "P2002" || /duplicate key|unique constraint|Unique constraint/i.test(text)) {
    const hit = UNIQUE_MESSAGES.find(([name]) => text.includes(name));
    return hit ? hit[1] : "Já existe um registro com estes dados.";
  }
  if (code === "P2003" || /foreign key constraint|violates foreign key/i.test(text)) {
    return "Este registro está em uso e não pode ser removido.";
  }
  if (/violates check constraint/i.test(text)) return "Algum valor informado não é permitido.";
  return null;
}
