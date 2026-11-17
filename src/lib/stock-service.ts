import "server-only";
import type { Tx } from "@/lib/db";
import type { Reason } from "@/lib/rules/stock";

export type Movement = {
  itemId: string;
  direction: "IN" | "OUT";
  reason: Reason;
  qtyMilli: number;
  unitCostCents?: number | null;
  note?: string | null;
  purchaseId?: string;
  orderId?: string;
  createdById: string;
};

/**
 * Lança uma movimentação no livro-razão do estoque. O saldo do item é atualizado pelo trigger do banco,
 * que também recusa saldo negativo em consumo, perda e ajuste de saída.
 */
export async function moveStock(tx: Tx, m: Movement) {
  return tx.stockMovement.create({
    data: {
      itemId: m.itemId,
      direction: m.direction,
      reason: m.reason,
      qtyMilli: m.qtyMilli,
      unitCostCents: m.unitCostCents ?? null,
      note: m.note ?? null,
      purchaseId: m.purchaseId,
      orderId: m.orderId,
      createdById: m.createdById,
    },
  });
}
