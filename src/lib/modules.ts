// Catálogo de módulos e níveis de acesso. Sem dependências de servidor: usado no cliente e no proxy.

export const MODULES = [
  { key: "FINANCEIRO", label: "Financeiro", description: "Lançamento de receitas e despesas, contas a receber e a pagar, extrato e fluxo de caixa.", paths: ["/financeiro"] },
  { key: "DASHBOARD", label: "Dashboard", description: "Painel com gráficos e indicadores de faturamento, despesas, vendas e estoque.", paths: ["/dashboard"] },
  { key: "COMPRAS", label: "Compras", description: "Registro das compras; entra no estoque e gera a despesa automaticamente.", paths: ["/compras"] },
  { key: "ESTOQUE", label: "Estoque", description: "Saldo dos itens, consumo, perdas, ajustes e histórico de movimentações.", paths: ["/estoque"] },
  { key: "PEDIDOS", label: "Pedidos", description: "Lançamento rápido de pedidos (mesa, balcão, delivery e encomendas) e fechamento com pagamento.", paths: ["/pedidos"] },
  { key: "CADASTROS", label: "Cadastros", description: "Itens (compra e venda), categorias financeiras, formas de pagamento, fornecedores e clientes.", paths: ["/cadastros"] },
] as const;

/**
 * Recursos opcionais: partes de um módulo que o fornecedor liga ou desliga no console.
 * Desligados, somem do menu e das telas que dependem deles. Começam desligados.
 */
export const FEATURES = [
  { key: "CLIENTES", label: "Cadastro de clientes", module: "CADASTROS", description: "Aba Clientes em Cadastros e a escolha de cliente em pedidos de entrega/encomenda e receitas. Desligado, o nome do cliente do pedido continua sendo digitado." },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
export const FEATURE_KEYS = FEATURES.map((f) => f.key) as FeatureKey[];
export const DEFAULT_ENABLED_FEATURES: FeatureKey[] = [];

export function parseEnabledFeatures(value: unknown): FeatureKey[] {
  return Array.isArray(value) ? FEATURE_KEYS.filter((k) => value.includes(k)) : [];
}

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Level = "NONE" | "VIEW" | "EDIT";
export type Permissions = Partial<Record<ModuleKey, Level>>;
export type Access = ModuleKey | "ADMIN";
export type Role = "ADMIN" | "STAFF";

export const MODULE_KEYS = MODULES.map((m) => m.key) as ModuleKey[];

/** Todos os módulos vêm liberados em uma instalação nova; o fornecedor pode desligar depois. */
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [...MODULE_KEYS];

export const LEVEL_LABELS: Record<Level, string> = { NONE: "Sem acesso", VIEW: "Consulta", EDIT: "Edita" };

export const moduleLabel = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key;

/** Caminhos exclusivos do administrador da empresa. */
const ADMIN_PATHS = ["/usuarios", "/perfis", "/auditoria"];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Módulo (ou "ADMIN") responsável por um caminho; null = livre para qualquer usuário logado. */
export function moduleForPath(pathname: string): Access | null {
  if (ADMIN_PATHS.some((p) => under(pathname, p))) return "ADMIN";
  for (const m of MODULES) if (m.paths.some((p) => under(pathname, p))) return m.key;
  return null;
}

export function parsePermissions(value: unknown): Permissions {
  const result: Permissions = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of MODULE_KEYS) {
      const level = (value as Record<string, unknown>)[key];
      if (level === "VIEW" || level === "EDIT") result[key] = level;
    }
  }
  return result;
}

export function parseEnabledModules(value: unknown): ModuleKey[] {
  return Array.isArray(value) ? MODULE_KEYS.filter((k) => value.includes(k)) : [];
}

/** Nível efetivo de um usuário em um módulo, considerando o que o fornecedor liberou. */
export function levelFor(
  subject: { role: Role; permissions: Permissions; enabled: ModuleKey[] },
  module: ModuleKey,
): Level {
  if (!subject.enabled.includes(module)) return "NONE";
  if (subject.role === "ADMIN") return "EDIT";
  return subject.permissions[module] ?? "NONE";
}

export const atLeast = (level: Level, needed: Level) =>
  needed === "NONE" || (needed === "VIEW" ? level !== "NONE" : level === "EDIT");
