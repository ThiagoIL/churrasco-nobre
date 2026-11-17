/** Categorias do sistema: usadas pelas vendas (pedidos) e pelas compras. Não podem ser renomeadas nem desativadas. */
export const SYSTEM_CATEGORIES = {
  SALES: { name: "Vendas", kind: "INCOME" },
  PURCHASES: { name: "Compras de insumos", kind: "EXPENSE" },
} as const;
