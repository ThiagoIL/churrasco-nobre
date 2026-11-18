import "server-only";
import { db } from "@/lib/db";
import type { CatalogItem } from "@/components/line-builder";
import { featureOn } from "@/lib/features";

/** Itens ativos para os seletores (pedido, compra, saída de estoque). */
export async function catalogItems(where: { sellable?: true; purchasable?: true; trackStock?: true }): Promise<CatalogItem[]> {
  const items = await db.item.findMany({
    where: { active: true, ...where },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, groupName: true, code: true, priceCents: true, costCents: true, stockQtyMilli: true, trackStock: true },
  });
  return items.map(({ stockQtyMilli, ...i }) => ({ ...i, stockMilli: stockQtyMilli }));
}

/** Opções (id, nome) de cadastros ativos para campos de seleção. */
export async function selectOptions() {
  const customersEnabled = await featureOn("CLIENTES");
  const [categories, methods, suppliers, customers] = await Promise.all([
    db.financialCategory.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true, isSystem: true } }),
    db.paymentMethod.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    customersEnabled ? db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return { categories, methods, suppliers, customers, customersEnabled };
}
