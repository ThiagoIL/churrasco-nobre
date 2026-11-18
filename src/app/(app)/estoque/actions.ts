"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { UserError, optional, optionalQuantity, parseForm, quantity, requiredEnum, uuid, type FormState } from "@/lib/form";
import { parseLines } from "@/lib/lines";
import { moveStock } from "@/lib/stock-service";

/** Saída de estoque por consumo (cozinha, evento) ou perda/desperdício, com vários itens de uma vez. */
export async function stockOutAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ESTOQUE", formData, async (user) => {
    const parsed = parseForm(
      z.object({ reason: requiredEnum(["CONSUMPTION", "LOSS"] as const, "Motivo"), note: optional(200), lines: z.string().max(60_000).optional() }),
      formData,
    );
    if (parsed.state) return parsed.state;
    const { reason, note } = parsed.data;

    let lines;
    try {
      lines = parseLines(parsed.data.lines);
    } catch (error) {
      throw new UserError((error as Error).message);
    }
    const items = await db.item.findMany({ where: { id: { in: lines.map((l) => l.itemId) } }, select: { id: true, name: true, active: true, trackStock: true } });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const l of lines) {
      const item = byId.get(l.itemId);
      if (!item || !item.active) throw new UserError("Um dos itens não está disponível.");
      if (!item.trackStock) throw new UserError(`O item “${item.name}” não controla estoque.`);
    }

    await db.$transaction(async (tx) => {
      for (const l of lines) {
        await moveStock(tx, { itemId: l.itemId, direction: "OUT", reason, qtyMilli: l.qtyMilli, note, createdById: user.id });
      }
      await audit({ action: "estoque.saida", entity: "estoque", userId: user.id, actor: user.email, data: { motivo: reason, itens: lines.length, observacao: note } }, tx);
    });
    return { success: `${reason === "LOSS" ? "Perda" : "Consumo"} lançado(a) para ${lines.length} ${lines.length === 1 ? "item" : "itens"}. O saldo foi atualizado.` };
  });
}

/** Ajuste de inventário: informa a quantidade contada e o sistema lança a diferença. */
export async function stockAdjustAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ESTOQUE", formData, async (user) => {
    const parsed = parseForm(z.object({ itemId: uuid("o item"), counted: quantity("Quantidade contada", { allowZero: true }), note: optional(200) }), formData);
    if (parsed.state) return parsed.state;
    const { itemId, counted, note } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ stock: number; track: boolean; name: string }[]>`
        SELECT stock_qty_milli AS stock, track_stock AS track, name FROM items WHERE id = ${itemId}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new UserError("Item não encontrado.");
      if (!row.track) throw new UserError(`O item “${row.name}” não controla estoque.`);
      const delta = counted - row.stock;
      if (delta === 0) throw new UserError("A quantidade contada é igual ao saldo atual: nada a ajustar.");
      await moveStock(tx, {
        itemId, direction: delta > 0 ? "IN" : "OUT", reason: "ADJUSTMENT", qtyMilli: Math.abs(delta),
        note: note ?? "Ajuste de inventário", createdById: user.id,
      });
      await audit({ action: "estoque.ajuste", entity: "item", entityId: itemId, userId: user.id, actor: user.email, data: { de: row.stock, para: counted, observacao: note } }, tx);
      return { name: row.name, delta };
    });
    return { success: `Estoque de “${result.name}” ajustado (${result.delta > 0 ? "+" : "−"}${(Math.abs(result.delta) / 1000).toString().replace(".", ",")}).` };
  });
}

/** Saldo inicial: quanto já existe em estoque ao começar a usar o sistema (entrada por ajuste, vários itens de uma vez). */
export async function stockInitialAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ESTOQUE", formData, async (user) => {
    const parsed = parseForm(z.object({ lines: z.string().max(60_000).optional() }), formData);
    if (parsed.state) return parsed.state;

    let lines;
    try {
      lines = parseLines(parsed.data.lines);
    } catch (error) {
      throw new UserError((error as Error).message);
    }
    const items = await db.item.findMany({ where: { id: { in: lines.map((l) => l.itemId) } }, select: { id: true, name: true, active: true, trackStock: true } });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const l of lines) {
      const item = byId.get(l.itemId);
      if (!item || !item.active) throw new UserError("Um dos itens não está disponível.");
      if (!item.trackStock) throw new UserError(`O item “${item.name}” não controla estoque.`);
    }

    await db.$transaction(async (tx) => {
      for (const l of lines) {
        await moveStock(tx, { itemId: l.itemId, direction: "IN", reason: "ADJUSTMENT", qtyMilli: l.qtyMilli, note: "Saldo inicial", createdById: user.id });
      }
      await audit({ action: "estoque.saldo_inicial", entity: "estoque", userId: user.id, actor: user.email, data: { itens: lines.length } }, tx);
    });
    return { success: `Saldo inicial lançado para ${lines.length} ${lines.length === 1 ? "item" : "itens"}.` };
  });
}

/** Estoque mínimo de um item: abaixo dele o item aparece como “baixo”. Vazio ou 0 = sem mínimo. */
export async function setMinStockAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ESTOQUE", formData, async (user) => {
    const parsed = parseForm(z.object({ itemId: uuid("o item"), minStock: optionalQuantity("Estoque mínimo") }), formData);
    if (parsed.state) return parsed.state;
    const { itemId, minStock } = parsed.data;
    const item = await db.item.findUnique({ where: { id: itemId }, select: { name: true, minStockMilli: true } });
    if (!item) throw new UserError("Item não encontrado.");
    if (item.minStockMilli === minStock) return { success: "Mínimo mantido." };
    await db.item.update({ where: { id: itemId }, data: { minStockMilli: minStock } });
    await audit({ action: "estoque.minimo", entity: "item", entityId: itemId, userId: user.id, actor: user.email, data: { item: item.name, de: item.minStockMilli, para: minStock } });
    return { success: "Mínimo salvo." };
  });
}
