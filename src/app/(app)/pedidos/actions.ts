"use server";

import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { UserError, optional, optionalMoney, optionalUuid, parseForm, requiredEnum, uuid, type FormState } from "@/lib/form";
import { parseLines } from "@/lib/lines";
import { MAX_CENTS, formatMoney, lineTotal } from "@/lib/money";
import { dateOnly, todayString } from "@/lib/dates";
import { moveStock } from "@/lib/stock-service";
import { SYSTEM_CATEGORIES } from "@/lib/system-categories";
import { orderWho } from "@/lib/order-utils";
import { featureOn } from "@/lib/features";

const orderSchema = z.object({
  id: optionalUuid(),
  channel: requiredEnum(["TABLE", "DELIVERY"] as const, "Tipo do pedido"),
  tableLabel: optional(30),
  customerId: optionalUuid(),
  customerName: optional(80),
  phone: optional(30),
  address: optional(200),
  freight: optionalMoney("Frete"),
  note: optional(300),
  lines: z.string().max(60_000).optional(),
});

/** Cria ou edita (enquanto aberto) um pedido. Os preços vêm do cadastro, nunca do navegador. */
export async function saveOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("PEDIDOS", formData, async (user) => {
    const parsed = parseForm(orderSchema, formData);
    if (parsed.state) return parsed.state;
    const d = parsed.data;

    let lines;
    try {
      lines = parseLines(d.lines);
    } catch (error) {
      throw new UserError((error as Error).message);
    }

    let customerName = d.customerName;
    let phone = d.phone;
    const customersOn = await featureOn("CLIENTES");
    if (d.customerId && customersOn) {
      const customer = await db.customer.findUnique({ where: { id: d.customerId } });
      if (!customer) throw new UserError("Cliente não encontrado.");
      customerName ||= customer.name;
      phone ||= customer.phone;
    }
    if (d.channel === "TABLE") {
      if (!d.tableLabel) throw new UserError("Escolha a mesa ou comanda.", { tableLabel: "Escolha a mesa ou comanda" });
      // só mesas cadastradas e ativas; um pedido já aberto pode manter a mesa que tinha
      const known = await db.diningTable.findFirst({ where: { name: d.tableLabel, active: true }, select: { id: true } });
      const current = d.id ? await db.order.findUnique({ where: { id: d.id }, select: { tableLabel: true } }) : null;
      if (!known && current?.tableLabel !== d.tableLabel) throw new UserError("Escolha uma mesa ou comanda cadastrada.", { tableLabel: "Mesa ou comanda não cadastrada" });
    }
    if (d.channel === "DELIVERY" && !customerName) throw new UserError("Informe o nome do cliente.", { customerName: "Informe o nome" });
    const freight = d.channel === "DELIVERY" ? d.freight ?? 0 : 0;

    const items = await db.item.findMany({ where: { id: { in: lines.map((l) => l.itemId) } } });
    const byId = new Map(items.map((i) => [i.id, i]));
    const rows = lines.map((l) => {
      const item = byId.get(l.itemId);
      if (!item || !item.active || !item.sellable) throw new UserError("Um dos itens não está disponível para venda.");
      const totalCents = lineTotal(item.priceCents, l.qtyMilli);
      if (totalCents > MAX_CENTS) throw new UserError(`Valor muito alto no item “${item.name}”.`);
      return { itemId: item.id, name: item.name, unit: item.unit, qtyMilli: l.qtyMilli, unitPriceCents: item.priceCents, totalCents, note: l.note };
    });
    const subtotal = rows.reduce((s, r) => s + r.totalCents, 0);
    if (subtotal + freight > MAX_CENTS) throw new UserError("O total do pedido passou do limite permitido.");

    const header = {
      channel: d.channel,
      tableLabel: d.channel === "TABLE" ? d.tableLabel : null,
      customerId: d.channel === "DELIVERY" && d.customerId && customersOn ? d.customerId : null,
      customerName: d.channel === "DELIVERY" ? customerName : null,
      phone: d.channel === "DELIVERY" ? phone : null,
      address: d.channel === "DELIVERY" ? d.address : null,
      freightCents: freight,
      note: d.note,
    };

    if (d.id) {
      const orderId = d.id;
      await db.$transaction(async (tx) => {
        await lockOpenOrder(tx, orderId);
        const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
        const discount = Math.min(current.discountCents, subtotal);
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({ data: rows.map((r) => ({ ...r, orderId })) });
        const total = subtotal - discount + freight;
        await tx.order.update({ where: { id: orderId }, data: { ...header, discountCents: discount, totalCents: total } });
        await audit({ action: "pedido.editou", entity: "pedido", entityId: orderId, userId: user.id, actor: user.email, data: { numero: current.number, total, frete: freight, itens: rows.length } }, tx);
      });
      return { redirectTo: `/pedidos/${orderId}` };
    }

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: { ...header, totalCents: subtotal + freight, createdById: user.id, items: { create: rows } },
      });
      await audit({ action: "pedido.criou", entity: "pedido", entityId: created.id, userId: user.id, actor: user.email, data: { numero: created.number, canal: d.channel, total: subtotal + freight, frete: freight, itens: rows.length } }, tx);
      return created;
    });
    return { redirectTo: `/pedidos/${order.id}` };
  });
}

/** Trava a linha do pedido e confirma que ele continua aberto (evita fechar/editar duas vezes ao mesmo tempo). */
async function lockOpenOrder(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status::text FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new UserError("Pedido não encontrado.");
  if (rows[0].status !== "OPEN") throw new UserError("Este pedido não está mais aberto.");
}

/**
 * Fecha o pedido com o pagamento: grava forma de pagamento e desconto, lança a receita no financeiro
 * e dá baixa no estoque dos itens vendidos que controlam saldo.
 */
export async function payOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("PEDIDOS", formData, async (user) => {
    const parsed = parseForm(z.object({ id: uuid("o pedido"), paymentMethodId: uuid("a forma de pagamento"), discount: optionalMoney("Desconto") }), formData);
    if (parsed.state) return parsed.state;
    const { id, paymentMethodId } = parsed.data;

    const method = await db.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (!method || !method.active) throw new UserError("Escolha uma forma de pagamento ativa.", { paymentMethodId: "Forma de pagamento inválida" });
    const category = await db.financialCategory.findFirst({ where: { isSystem: true, kind: SYSTEM_CATEGORIES.SALES.kind, name: SYSTEM_CATEGORIES.SALES.name } });
    if (!category) throw new UserError("A categoria “Vendas” não foi encontrada. Reinicie o sistema.");

    await db.$transaction(async (tx) => {
      await lockOpenOrder(tx, id);
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: { include: { item: { select: { trackStock: true } } } } } });
      if (order.items.length === 0) throw new UserError("O pedido não tem itens.");
      const subtotal = order.items.reduce((s, l) => s + l.totalCents, 0);
      const discount = parsed.data.discount ?? 0;
      if (discount > subtotal) throw new UserError("O desconto não pode ser maior que o total do pedido.", { discount: "Maior que o total" });
      const total = subtotal - discount + order.freightCents;

      await tx.order.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), paymentMethodId, discountCents: discount, totalCents: total } });
      if (total > 0) {
        await tx.financialEntry.create({
          data: {
            kind: "INCOME", status: "PAID", description: `Pedido nº ${order.number} — ${orderWho(order)}`, amountCents: total, date: dateOnly(todayString()),
            categoryId: category.id, paymentMethodId, customerId: order.customerId, source: "ORDER", orderId: id, createdById: user.id,
          },
        });
      }
      for (const l of order.items) {
        if (l.item.trackStock) await moveStock(tx, { itemId: l.itemId, direction: "OUT", reason: "SALE", qtyMilli: l.qtyMilli, orderId: id, createdById: user.id });
      }
      await audit({ action: "pedido.pagou", entity: "pedido", entityId: id, userId: user.id, actor: user.email, data: { numero: order.number, total, desconto: discount, frete: order.freightCents, pagamento: method.name } }, tx);
    });
    return { redirectTo: `/pedidos/${id}` };
  });
}

/** Cancela o pedido. Se já estava pago, estorna a receita e devolve o estoque. */
export async function cancelOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("PEDIDOS", formData, async (user) => {
    const parsed = parseForm(z.object({ id: uuid("o pedido") }), formData);
    if (parsed.state) return parsed.state;
    const { id } = parsed.data;

    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status::text FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
      if (rows.length === 0) throw new UserError("Pedido não encontrado.");
      if (rows[0].status === "CANCELED") throw new UserError("Este pedido já está cancelado.");
      const wasPaid = rows[0].status === "PAID";

      const order = await tx.order.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date() } });
      if (wasPaid) {
        await tx.financialEntry.updateMany({ where: { orderId: id, status: { not: "CANCELED" } }, data: { status: "CANCELED", canceledAt: new Date() } });
        const sales = await tx.stockMovement.findMany({ where: { orderId: id, reason: "SALE" } });
        for (const m of sales) {
          await moveStock(tx, { itemId: m.itemId, direction: "IN", reason: "REVERSAL", qtyMilli: m.qtyMilli, note: `Cancelamento do pedido nº ${order.number}`, orderId: id, createdById: user.id });
        }
      }
      await audit({ action: "pedido.cancelou", entity: "pedido", entityId: id, userId: user.id, actor: user.email, data: { numero: order.number, estava_pago: wasPaid, total: formatMoney(order.totalCents) } }, tx);
    });
    return { redirectTo: `/pedidos/${id}` };
  });
}
