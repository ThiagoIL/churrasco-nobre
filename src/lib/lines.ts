// Linhas de itens enviadas pelos formulários de pedido, compra e saída de estoque. Sem dependências de servidor.
import { z } from "zod";
import { MAX_CENTS, parseMoney, parseQty } from "@/lib/money";

export const MAX_LINES = 100;

export type FormLine = {
  itemId: string;
  /** Quantidade digitada ("1,5"). */
  qty: string;
  /** Custo unitário digitado (somente compras). */
  unitCost?: string;
  note?: string;
};

export type ParsedLine = { itemId: string; qtyMilli: number; unitCostCents: number | null; note: string | null };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const lineSchema = z.object({
  itemId: z.string().regex(uuidRe, "Item inválido"),
  qty: z.string().max(20),
  unitCost: z.string().max(20).optional(),
  note: z.string().max(200).optional(),
});

/**
 * Lê o JSON do campo `lines`: valida tamanho, ids, quantidades (até 3 casas) e custos.
 * Junta linhas repetidas do mesmo item. Lança Error com mensagem em português.
 */
export function parseLines(json: string | undefined, { requireCost = false }: { requireCost?: boolean } = {}): ParsedLine[] {
  if (!json) throw new Error("Adicione ao menos um item.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Não foi possível ler os itens. Tente de novo.");
  }
  const list = z.array(lineSchema).max(MAX_LINES, `No máximo ${MAX_LINES} itens por lançamento.`).safeParse(raw);
  if (!list.success) throw new Error(list.error.issues[0]?.message || "Itens inválidos.");
  if (list.data.length === 0) throw new Error("Adicione ao menos um item.");

  const merged = new Map<string, ParsedLine>();
  for (const [i, l] of list.data.entries()) {
    const qtyMilli = parseQty(l.qty);
    if (qtyMilli === null) throw new Error(`Quantidade inválida na linha ${i + 1}.`);
    let unitCostCents: number | null = null;
    if (requireCost) {
      unitCostCents = parseMoney(l.unitCost ?? "");
      if (unitCostCents === null || unitCostCents < 0 || unitCostCents > MAX_CENTS) throw new Error(`Valor inválido na linha ${i + 1}.`);
    }
    const key = `${l.itemId}|${unitCostCents ?? ""}`;
    const prev = merged.get(key);
    if (prev) prev.qtyMilli += qtyMilli;
    else merged.set(key, { itemId: l.itemId, qtyMilli, unitCostCents, note: l.note?.trim() || null });
  }
  return [...merged.values()];
}
