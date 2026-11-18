"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import {
  UserError, checkbox, optional, optionalMoney, optionalQuantity, optionalUuid, parseForm, required, requiredEnum, uuid, type FormState,
} from "@/lib/form";
import { moveStock } from "@/lib/stock-service";
import { featureOn } from "@/lib/features";

const ENTITY_LABELS = { categoria: "categoria", pagamento: "forma de pagamento", fornecedor: "fornecedor", cliente: "cliente", item: "item" } as const;

// ───────────────────────── categorias financeiras ─────────────────────────

export async function saveCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    const parsed = parseForm(z.object({ id: optionalUuid(), name: required("Nome", 60), kind: requiredEnum(["INCOME", "EXPENSE"] as const, "Tipo") }), formData);
    if (parsed.state) return parsed.state;
    const { id, name, kind } = parsed.data;
    if (id) {
      const current = await db.financialCategory.findUnique({ where: { id } });
      if (!current) throw new UserError("Categoria não encontrada.");
      if (current.isSystem) throw new UserError("Categorias do sistema não podem ser alteradas.");
      const used = current.kind !== kind && (await db.financialEntry.count({ where: { categoryId: id } })) > 0;
      if (used) throw new UserError("Esta categoria já tem lançamentos: não dá para mudar o tipo.");
      await db.financialCategory.update({ where: { id }, data: { name, kind } });
      await audit({ action: "categoria.editou", entity: "categoria", entityId: id, userId: user.id, actor: user.email, data: { nome: name } });
      return { redirectTo: "/cadastros/categorias" };
    }
    const created = await db.financialCategory.create({ data: { name, kind } });
    await audit({ action: "categoria.criou", entity: "categoria", entityId: created.id, userId: user.id, actor: user.email, data: { nome: name, tipo: kind } });
    return { success: `Categoria “${name}” criada.` };
  });
}

// ───────────────────────── formas de pagamento ─────────────────────────

export async function savePaymentMethodAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    const parsed = parseForm(z.object({ id: optionalUuid(), name: required("Nome", 40) }), formData);
    if (parsed.state) return parsed.state;
    const { id, name } = parsed.data;
    if (id) {
      await db.paymentMethod.update({ where: { id }, data: { name } });
      await audit({ action: "pagamento.editou", entity: "forma_de_pagamento", entityId: id, userId: user.id, actor: user.email, data: { nome: name } });
      return { redirectTo: "/cadastros/pagamentos" };
    }
    const created = await db.paymentMethod.create({ data: { name } });
    await audit({ action: "pagamento.criou", entity: "forma_de_pagamento", entityId: created.id, userId: user.id, actor: user.email, data: { nome: name } });
    return { success: `Forma de pagamento “${name}” criada.` };
  });
}

// ───────────────────────── fornecedores ─────────────────────────

export async function saveSupplierAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    if (!(await featureOn("FORNECEDORES"))) throw new UserError("O cadastro de fornecedores não está liberado neste sistema.");
    const parsed = parseForm(z.object({ id: optionalUuid(), name: required("Nome", 120), phone: optional(30), document: optional(30), note: optional(300) }), formData);
    if (parsed.state) return parsed.state;
    const { id, ...data } = parsed.data;
    if (id) {
      await db.supplier.update({ where: { id }, data });
      await audit({ action: "fornecedor.editou", entity: "fornecedor", entityId: id, userId: user.id, actor: user.email, data: { nome: data.name } });
      return { redirectTo: "/cadastros/fornecedores" };
    }
    const created = await db.supplier.create({ data });
    await audit({ action: "fornecedor.criou", entity: "fornecedor", entityId: created.id, userId: user.id, actor: user.email, data: { nome: data.name } });
    return { success: `Fornecedor “${data.name}” criado.` };
  });
}

// ───────────────────────── clientes ─────────────────────────

export async function saveCustomerAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    if (!(await featureOn("CLIENTES"))) throw new UserError("O cadastro de clientes não está liberado neste sistema.");
    const parsed = parseForm(z.object({ id: optionalUuid(), name: required("Nome", 120), phone: optional(30), note: optional(300) }), formData);
    if (parsed.state) return parsed.state;
    const { id, ...data } = parsed.data;
    if (id) {
      await db.customer.update({ where: { id }, data });
      await audit({ action: "cliente.editou", entity: "cliente", entityId: id, userId: user.id, actor: user.email, data: { nome: data.name } });
      return { redirectTo: "/cadastros/clientes" };
    }
    const created = await db.customer.create({ data });
    await audit({ action: "cliente.criou", entity: "cliente", entityId: created.id, userId: user.id, actor: user.email, data: { nome: data.name } });
    return { success: `Cliente “${data.name}” criado.` };
  });
}

// ───────────────────────── itens ─────────────────────────

const itemSchema = z.object({
  id: optionalUuid(),
  name: required("Nome", 120),
  code: optional(30),
  unit: required("Unidade", 12),
  groupName: optional(40),
  purchasable: checkbox(),
  sellable: checkbox(),
  trackStock: checkbox(),
  cost: optionalMoney("Custo"),
  price: optionalMoney("Preço"),
  minStock: optionalQuantity("Estoque mínimo"),
  initialStock: optionalQuantity("Saldo inicial"),
  active: checkbox(),
  note: optional(300),
});

export async function saveItemAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    const parsed = parseForm(itemSchema, formData);
    if (parsed.state) return parsed.state;
    const d = parsed.data;
    if (!d.purchasable && !d.sellable) throw new UserError("Marque se o item é para compra, para venda ou os dois.");

    const data = {
      name: d.name, code: d.code, unit: d.unit, groupName: d.groupName,
      purchasable: d.purchasable, sellable: d.sellable, trackStock: d.trackStock,
      costCents: d.cost ?? 0, priceCents: d.price ?? 0, minStockMilli: d.minStock, note: d.note,
    };

    if (d.id) {
      await db.item.update({ where: { id: d.id }, data: { ...data, active: d.active } });
      await audit({ action: "item.editou", entity: "item", entityId: d.id, userId: user.id, actor: user.email, data: { nome: d.name, custo: data.costCents, preco: data.priceCents } });
      return { redirectTo: "/cadastros/itens" };
    }

    await db.$transaction(async (tx) => {
      const item = await tx.item.create({ data: { ...data, active: true } });
      if (d.trackStock && d.initialStock > 0) {
        await moveStock(tx, { itemId: item.id, direction: "IN", reason: "ADJUSTMENT", qtyMilli: d.initialStock, note: "Saldo inicial", createdById: user.id });
      }
      await audit({ action: "item.criou", entity: "item", entityId: item.id, userId: user.id, actor: user.email, data: { nome: d.name, custo: data.costCents, preco: data.priceCents } }, tx);
    });
    return { redirectTo: "/cadastros/itens" };
  });
}

// ───────────────────────── ativar, desativar e excluir ─────────────────────────

const toggleSchema = z.object({ entity: requiredEnum(["categoria", "pagamento", "fornecedor", "cliente", "item"] as const, "Cadastro"), id: uuid("o registro"), active: z.enum(["true", "false"]) });

/** Desativa (some das listas de escolha, mantém o histórico) ou reativa um cadastro. */
export async function toggleActiveAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    const parsed = parseForm(toggleSchema, formData);
    if (parsed.state) return parsed.state;
    const { entity, id } = parsed.data;
    const active = parsed.data.active === "true";

    if (entity === "categoria") {
      const c = await db.financialCategory.findUnique({ where: { id } });
      if (!c) throw new UserError("Categoria não encontrada.");
      if (c.isSystem) throw new UserError("Categorias do sistema não podem ser desativadas.");
      await db.financialCategory.update({ where: { id }, data: { active } });
    } else if (entity === "pagamento") await db.paymentMethod.update({ where: { id }, data: { active } });
    else if (entity === "fornecedor") await db.supplier.update({ where: { id }, data: { active } });
    else if (entity === "cliente") await db.customer.update({ where: { id }, data: { active } });
    else await db.item.update({ where: { id }, data: { active } });

    await audit({ action: `${entity}.${active ? "ativou" : "desativou"}`, entity, entityId: id, userId: user.id, actor: user.email });
    return { success: active ? "Reativado." : "Desativado." };
  });
}

/** Exclui um cadastro que nunca foi usado. Com histórico, o banco recusa e o usuário é orientado a desativar. */
export async function deleteEntityAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("CADASTROS", formData, async (user) => {
    const parsed = parseForm(z.object({ entity: toggleSchema.shape.entity, id: toggleSchema.shape.id }), formData);
    if (parsed.state) return parsed.state;
    const { entity, id } = parsed.data;

    try {
      if (entity === "categoria") {
        const c = await db.financialCategory.findUnique({ where: { id } });
        if (c?.isSystem) throw new UserError("Categorias do sistema não podem ser excluídas.");
        await db.financialCategory.delete({ where: { id } });
      } else if (entity === "pagamento") await db.paymentMethod.delete({ where: { id } });
      else if (entity === "fornecedor") await db.supplier.delete({ where: { id } });
      else if (entity === "cliente") await db.customer.delete({ where: { id } });
      else await db.item.delete({ where: { id } });
    } catch (error) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Este ${ENTITY_LABELS[entity]} já tem histórico e não pode ser excluído. Desative-o: ele some das listas de escolha e o histórico é mantido.`);
    }
    await audit({ action: `${entity}.excluiu`, entity, entityId: id, userId: user.id, actor: user.email });
    return { success: "Excluído." };
  });
}
