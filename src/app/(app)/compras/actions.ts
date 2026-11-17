"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { UserError, checkbox, dateField, optional, optionalDate, optionalUuid, parseForm, uuid, type FormState } from "@/lib/form";
import { parseLines } from "@/lib/lines";
import { dateOnly } from "@/lib/dates";
import { MAX_CENTS, formatMoney, lineTotal } from "@/lib/money";
import { moveStock } from "@/lib/stock-service";

const schema = z.object({
  date: dateField("Data"),
  supplierId: optionalUuid(),
  categoryId: uuid("a categoria"),
  paymentMethodId: optionalUuid(),
  paid: checkbox(),
  dueDate: optionalDate("Vencimento"),
  invoiceNumber: optional(40),
  note: optional(300),
  lines: z.string().max(60_000).optional(),
});

/**
 * Registra uma compra: guarda os itens, dá entrada no estoque dos itens que controlam saldo,
 * atualiza o último custo de cada item e gera a despesa (paga ou a pagar) — tudo na mesma transação.
 */
export async function createPurchaseAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("COMPRAS", formData, async (user) => {
    const parsed = parseForm(schema, formData);
    if (parsed.state) return parsed.state;
    const d = parsed.data;

    let lines;
    try {
      lines = parseLines(d.lines, { requireCost: true });
    } catch (error) {
      throw new UserError((error as Error).message);
    }
    if (!d.paid && !d.dueDate) throw new UserError("Informe o vencimento da compra a pagar.", { dueDate: "Informe o vencimento" });

    const category = await db.financialCategory.findUnique({ where: { id: d.categoryId } });
    if (!category || !category.active || category.kind !== "EXPENSE") throw new UserError("Escolha uma categoria de despesa ativa.", { categoryId: "Categoria inválida" });

    const items = await db.item.findMany({ where: { id: { in: lines.map((l) => l.itemId) } } });
    const byId = new Map(items.map((i) => [i.id, i]));
    const priced = lines.map((l) => {
      const item = byId.get(l.itemId);
      if (!item || !item.active || !item.purchasable) throw new UserError("Um dos itens não está disponível para compra.");
      const totalCents = lineTotal(l.unitCostCents ?? 0, l.qtyMilli);
      if (totalCents > MAX_CENTS) throw new UserError(`Valor muito alto no item “${item.name}”.`);
      return { ...l, item, totalCents };
    });
    const total = priced.reduce((s, l) => s + l.totalCents, 0);
    if (total <= 0) throw new UserError("O total da compra precisa ser maior que zero.");
    if (total > MAX_CENTS) throw new UserError("O total da compra passou do limite permitido.");

    const created = await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          date: dateOnly(d.date),
          supplierId: d.supplierId,
          categoryId: d.categoryId,
          paymentMethodId: d.paymentMethodId,
          paid: d.paid,
          dueDate: d.paid ? null : dateOnly(d.dueDate!),
          totalCents: total,
          invoiceNumber: d.invoiceNumber,
          note: d.note,
          createdById: user.id,
          items: { create: priced.map((l) => ({ itemId: l.itemId, qtyMilli: l.qtyMilli, unitCostCents: l.unitCostCents ?? 0, totalCents: l.totalCents })) },
        },
      });

      const supplierName = d.supplierId ? (await tx.supplier.findUnique({ where: { id: d.supplierId }, select: { name: true } }))?.name : null;
      await tx.financialEntry.create({
        data: {
          kind: "EXPENSE",
          status: d.paid ? "PAID" : "PENDING",
          description: `Compra nº ${purchase.number}${supplierName ? ` — ${supplierName}` : ""}`,
          amountCents: total,
          date: dateOnly(d.paid ? d.date : d.dueDate!),
          categoryId: d.categoryId,
          paymentMethodId: d.paymentMethodId,
          supplierId: d.supplierId,
          note: d.invoiceNumber ? `NF ${d.invoiceNumber}` : null,
          source: "PURCHASE",
          purchaseId: purchase.id,
          createdById: user.id,
        },
      });

      for (const l of priced) {
        if (l.item.trackStock) {
          await moveStock(tx, { itemId: l.itemId, direction: "IN", reason: "PURCHASE", qtyMilli: l.qtyMilli, unitCostCents: l.unitCostCents, purchaseId: purchase.id, createdById: user.id });
        }
        if ((l.unitCostCents ?? 0) > 0) await tx.item.update({ where: { id: l.itemId }, data: { costCents: l.unitCostCents ?? 0 } });
      }
      await audit({ action: "compra.criou", entity: "compra", entityId: purchase.id, userId: user.id, actor: user.email, data: { numero: purchase.number, total, itens: priced.length } }, tx);
      return purchase;
    });
    return { redirectTo: `/compras/${created.id}` };
  });
}

/** Cancela a compra: estorna o estoque que ela deu entrada e cancela a despesa gerada. */
export async function cancelPurchaseAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("COMPRAS", formData, async (user) => {
    const parsed = parseForm(z.object({ id: uuid("a compra"), reason: optional(200) }), formData);
    if (parsed.state) return parsed.state;
    const { id, reason } = parsed.data;

    await db.$transaction(async (tx) => {
      // trava a compra para que dois cancelamentos simultâneos não estornem em dobro
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status::text FROM purchases WHERE id = ${id}::uuid FOR UPDATE`;
      if (locked.length === 0) throw new UserError("Compra não encontrada.");
      if (locked[0].status === "CANCELED") throw new UserError("Esta compra já está cancelada.");

      const purchase = await tx.purchase.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date(), cancelReason: reason } });
      await tx.financialEntry.updateMany({ where: { purchaseId: id, status: { not: "CANCELED" } }, data: { status: "CANCELED", canceledAt: new Date() } });

      const originals = await tx.stockMovement.findMany({ where: { purchaseId: id, reason: "PURCHASE" } });
      for (const m of originals) {
        await moveStock(tx, { itemId: m.itemId, direction: "OUT", reason: "REVERSAL", qtyMilli: m.qtyMilli, unitCostCents: m.unitCostCents, note: `Cancelamento da compra nº ${purchase.number}`, purchaseId: id, createdById: user.id });
      }
      await audit({ action: "compra.cancelou", entity: "compra", entityId: id, userId: user.id, actor: user.email, data: { numero: purchase.number, total: formatMoney(purchase.totalCents), motivo: reason } }, tx);
    });
    return { success: "Compra cancelada: estoque e despesa estornados." };
  });
}
