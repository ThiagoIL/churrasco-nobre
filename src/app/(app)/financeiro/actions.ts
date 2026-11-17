"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import {
  UserError, checkbox, dateField, money, optional, optionalUuid, parseForm, required, requiredEnum, uuid, type FormState,
} from "@/lib/form";
import { dateOnly, todayString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const entrySchema = z.object({
  id: optionalUuid(),
  kind: requiredEnum(["INCOME", "EXPENSE"] as const, "Tipo"),
  amount: money("Valor"),
  description: required("Descrição", 120),
  date: dateField("Data"),
  categoryId: uuid("a categoria"),
  paymentMethodId: optionalUuid(),
  supplierId: optionalUuid(),
  customerId: optionalUuid(),
  note: optional(300),
  paid: checkbox(),
  again: z.string().optional(),
});

/** Cria ou edita um lançamento manual de receita/despesa. */
export async function saveEntryAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("FINANCEIRO", formData, async (user) => {
    const parsed = parseForm(entrySchema, formData);
    if (parsed.state) return parsed.state;
    const d = parsed.data;

    const category = await db.financialCategory.findUnique({ where: { id: d.categoryId } });
    if (!category || !category.active) throw new UserError("Escolha uma categoria ativa.", { categoryId: "Categoria inválida" });
    if (category.kind !== d.kind) throw new UserError("A categoria escolhida não combina com o tipo do lançamento.", { categoryId: "Categoria de outro tipo" });

    const data = {
      kind: d.kind,
      status: d.paid ? ("PAID" as const) : ("PENDING" as const),
      description: d.description,
      amountCents: d.amount,
      date: dateOnly(d.date),
      categoryId: d.categoryId,
      paymentMethodId: d.paymentMethodId,
      // fornecedor só em despesa e cliente só em receita
      supplierId: d.kind === "EXPENSE" ? d.supplierId : null,
      customerId: d.kind === "INCOME" ? d.customerId : null,
      note: d.note,
    };

    if (d.id) {
      const current = await db.financialEntry.findUnique({ where: { id: d.id } });
      if (!current) throw new UserError("Lançamento não encontrado.");
      if (current.status === "CANCELED") throw new UserError("Lançamento cancelado não pode ser alterado.");
      if (current.source !== "MANUAL") throw new UserError("Este lançamento veio de uma compra ou pedido e não pode ser editado aqui.");
      await db.$transaction(async (tx) => {
        await tx.financialEntry.update({ where: { id: d.id! }, data });
        await audit({ action: "financeiro.editou", entity: "lancamento", entityId: d.id, userId: user.id, actor: user.email, data: { de: { valor: current.amountCents, descricao: current.description }, para: { valor: d.amount, descricao: d.description } } }, tx);
      });
      return { redirectTo: "/financeiro" };
    }

    const created = await db.$transaction(async (tx) => {
      const entry = await tx.financialEntry.create({ data: { ...data, source: "MANUAL", createdById: user.id } });
      await audit({ action: "financeiro.criou", entity: "lancamento", entityId: entry.id, userId: user.id, actor: user.email, data: { tipo: d.kind, valor: d.amount, descricao: d.description } }, tx);
      return entry;
    });
    if (d.again) return { success: `${d.kind === "INCOME" ? "Receita" : "Despesa"} de ${formatMoney(created.amountCents)} lançada. Pode lançar a próxima.` };
    return { redirectTo: "/financeiro" };
  });
}

/** Dá baixa em um lançamento pendente (recebido/pago), na data informada (padrão: hoje). */
export async function payEntryAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("FINANCEIRO", formData, async (user) => {
    const parsed = parseForm(z.object({ id: uuid("o lançamento"), date: dateField("Data").optional(), paymentMethodId: optionalUuid() }), formData);
    if (parsed.state) return parsed.state;
    const { id, paymentMethodId } = parsed.data;
    const date = parsed.data.date ?? todayString();

    await db.$transaction(async (tx) => {
      const entry = await tx.financialEntry.findUnique({ where: { id } });
      if (!entry) throw new UserError("Lançamento não encontrado.");
      if (entry.status !== "PENDING") throw new UserError("Este lançamento não está pendente.");
      await tx.financialEntry.update({
        where: { id },
        data: { status: "PAID", date: dateOnly(date), ...(paymentMethodId ? { paymentMethodId } : {}) },
      });
      if (entry.purchaseId) await tx.purchase.update({ where: { id: entry.purchaseId }, data: { paid: true } });
      await audit({ action: "financeiro.baixou", entity: "lancamento", entityId: id, userId: user.id, actor: user.email, data: { valor: entry.amountCents, data: date } }, tx);
    });
    return { success: "Baixa registrada." };
  });
}

/** Cancela um lançamento manual (fica no histórico, fora dos totais). */
export async function cancelEntryAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("FINANCEIRO", formData, async (user) => {
    const parsed = parseForm(z.object({ id: uuid("o lançamento") }), formData);
    if (parsed.state) return parsed.state;
    const { id } = parsed.data;
    await db.$transaction(async (tx) => {
      const entry = await tx.financialEntry.findUnique({ where: { id } });
      if (!entry) throw new UserError("Lançamento não encontrado.");
      if (entry.status === "CANCELED") throw new UserError("Este lançamento já está cancelado.");
      if (entry.source !== "MANUAL") throw new UserError("Este lançamento veio de uma compra ou pedido: cancele a compra ou o pedido.");
      await tx.financialEntry.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date() } });
      await audit({ action: "financeiro.cancelou", entity: "lancamento", entityId: id, userId: user.id, actor: user.email, data: { valor: entry.amountCents, descricao: entry.description } }, tx);
    });
    return { redirectTo: "/financeiro" };
  });
}
