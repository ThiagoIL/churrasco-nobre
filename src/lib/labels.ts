// Rótulos em português centralizados (telas, e-mails, exportações).

export const ENTRY_KIND_LABELS = { INCOME: "Receita", EXPENSE: "Despesa" } as const;
export const ENTRY_KIND_PLURAL = { INCOME: "Receitas", EXPENSE: "Despesas" } as const;

export const ENTRY_STATUS_LABELS = { PAID: "Pago", PENDING: "Pendente", CANCELED: "Cancelado" } as const;
/** Rótulo do status conforme o tipo (receita: "Recebido"; despesa: "Pago"). */
export const entryStatusLabel = (kind: "INCOME" | "EXPENSE", status: "PAID" | "PENDING" | "CANCELED") =>
  status === "PAID" ? (kind === "INCOME" ? "Recebido" : "Pago") : status === "PENDING" ? (kind === "INCOME" ? "A receber" : "A pagar") : "Cancelado";

export const ENTRY_SOURCE_LABELS = { MANUAL: "Manual", PURCHASE: "Compra", ORDER: "Pedido" } as const;

export const ORDER_STATUS_LABELS = { OPEN: "Aberto", PAID: "Pago", CANCELED: "Cancelado" } as const;
export const ORDER_CHANNEL_LABELS = { TABLE: "Mesa", COUNTER: "Balcão", DELIVERY: "Delivery", CATERING: "Encomenda" } as const;

export const PURCHASE_STATUS_LABELS = { RECEIVED: "Recebida", CANCELED: "Cancelada" } as const;

export const STOCK_REASON_LABELS = {
  PURCHASE: "Compra",
  CONSUMPTION: "Consumo",
  SALE: "Venda",
  LOSS: "Perda / desperdício",
  ADJUSTMENT: "Ajuste de inventário",
  REVERSAL: "Estorno",
} as const;

export const ROLE_LABELS = { ADMIN: "Administrador", STAFF: "Usuário" } as const;

export const UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct", "fardo", "porção", "saco", "lata", "garrafa"] as const;

/** Ações de auditoria ("entidade.verbo") em português. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Entrou no sistema",
  "auth.login_falhou": "Tentativa de login recusada",
  "auth.logout": "Saiu do sistema",
  "auth.senha_alterada": "Alterou a própria senha",
  "auth.senha_redefinida": "Redefiniu a senha pelo e-mail",
  "auth.recuperacao_pedida": "Pediu recuperação de senha",
  "auth.sessao_encerrada": "Encerrou uma sessão",
  "usuario.criou": "Criou usuário",
  "usuario.editou": "Editou usuário",
  "usuario.desativou": "Desativou usuário",
  "usuario.ativou": "Reativou usuário",
  "usuario.senha_provisoria": "Gerou senha provisória",
  "perfil.criou": "Criou perfil de acesso",
  "perfil.editou": "Editou perfil de acesso",
  "perfil.excluiu": "Excluiu perfil de acesso",
  "financeiro.criou": "Criou lançamento",
  "financeiro.editou": "Editou lançamento",
  "financeiro.baixou": "Baixou lançamento (pago/recebido)",
  "financeiro.cancelou": "Cancelou lançamento",
  "compra.criou": "Registrou compra",
  "compra.cancelou": "Cancelou compra",
  "compra.anexou": "Anexou comprovante à compra",
  "compra.removeu_anexo": "Removeu comprovante da compra",
  "estoque.saida": "Lançou saída de estoque",
  "estoque.ajuste": "Ajustou o estoque",
  "pedido.criou": "Criou pedido",
  "pedido.editou": "Editou pedido",
  "pedido.pagou": "Fechou pedido (pago)",
  "pedido.cancelou": "Cancelou pedido",
  "item.criou": "Criou item",
  "item.editou": "Editou item",
  "item.ativou": "Reativou item",
  "item.desativou": "Desativou item",
  "categoria.criou": "Criou categoria",
  "categoria.editou": "Editou categoria",
  "categoria.ativou": "Reativou categoria",
  "categoria.desativou": "Desativou categoria",
  "pagamento.criou": "Criou forma de pagamento",
  "pagamento.editou": "Editou forma de pagamento",
  "pagamento.ativou": "Reativou forma de pagamento",
  "pagamento.desativou": "Desativou forma de pagamento",
  "fornecedor.criou": "Criou fornecedor",
  "fornecedor.editou": "Editou fornecedor",
  "fornecedor.ativou": "Reativou fornecedor",
  "fornecedor.desativou": "Desativou fornecedor",
  "mesa.criou": "Cadastrou mesa/comanda",
  "mesa.editou": "Editou mesa/comanda",
  "mesa.ativou": "Reativou mesa/comanda",
  "mesa.desativou": "Desativou mesa/comanda",
  "cliente.criou": "Criou cliente",
  "cliente.editou": "Editou cliente",
  "cliente.ativou": "Reativou cliente",
  "cliente.desativou": "Desativou cliente",
  "estoque.saldo_inicial": "Lançou saldo inicial",
  "estoque.minimo": "Alterou estoque mínimo",
  "exportacao.csv": "Exportou dados (CSV)",
};

/** Rótulo em português; ações sem rótulo próprio viram "Verbo entidade" (ex.: "item.excluiu" → "Excluiu item"). */
export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const [entity, verb] = action.split(".");
  return verb ? `${verb.charAt(0).toUpperCase()}${verb.slice(1).replace(/_/g, " ")} ${entity.replace(/_/g, " ")}` : action;
}
