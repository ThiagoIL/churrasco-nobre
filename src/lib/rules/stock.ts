// Regras de estoque (espelham o trigger apply_stock_movement do banco). Quantidades em milésimos.
export type Direction = "IN" | "OUT";
export type Reason = "PURCHASE" | "CONSUMPTION" | "SALE" | "LOSS" | "ADJUSTMENT" | "REVERSAL";

/** Motivos de saída que nunca podem deixar o saldo negativo. */
const STRICT_OUT: readonly Reason[] = ["CONSUMPTION", "LOSS", "ADJUSTMENT"];

export function isValidReason(direction: Direction, reason: Reason): boolean {
  if (reason === "PURCHASE") return direction === "IN";
  if (reason === "CONSUMPTION" || reason === "LOSS" || reason === "SALE") return direction === "OUT";
  return true;
}

export type StockResult = { ok: true; balance: number } | { ok: false; error: string; balance: number };

/** Saldo após a movimentação, ou o motivo de recusa. */
export function applyMovement(current: number, direction: Direction, reason: Reason, qtyMilli: number): StockResult {
  if (!Number.isInteger(qtyMilli) || qtyMilli <= 0) return { ok: false, error: "Quantidade inválida.", balance: current };
  if (!isValidReason(direction, reason)) return { ok: false, error: "Motivo incompatível com o tipo de movimento.", balance: current };
  const balance = current + (direction === "IN" ? qtyMilli : -qtyMilli);
  if (balance < 0 && direction === "OUT" && STRICT_OUT.includes(reason)) {
    return { ok: false, error: "Estoque insuficiente.", balance: current };
  }
  return { ok: true, balance };
}

/** Item com saldo igual ou abaixo do mínimo configurado (mínimo 0 = sem alerta, exceto saldo negativo). */
export function stockLevel(balance: number, min: number): "negative" | "zero" | "low" | "ok" {
  if (balance < 0) return "negative";
  if (balance === 0) return "zero";
  if (min > 0 && balance <= min) return "low";
  return "ok";
}
