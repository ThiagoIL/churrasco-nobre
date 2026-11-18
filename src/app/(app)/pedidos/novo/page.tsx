import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { catalogItems } from "@/lib/catalog";
import { featureOn } from "@/lib/features";
import { PageHeader } from "@/components/ui/primitives";
import { OrderForm } from "@/app/(app)/pedidos/order-form";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function NewOrderPage() {
  await requireModule("PEDIDOS", "EDIT");
  const customersEnabled = await featureOn("CLIENTES");
  const [items, customers, tables] = await Promise.all([
    catalogItems({ sellable: true }),
    customersEnabled ? db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    db.diningTable.findMany({ where: { active: true }, select: { name: true } }),
  ]);
  const tableNames = tables.map((t) => t.name).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  return (
    <>
      <PageHeader title="Novo pedido" back={{ href: "/pedidos", label: "Pedidos" }} />
      <div className="max-w-5xl"><OrderForm items={items} customers={customers} tables={tableNames} customersEnabled={customersEnabled} /></div>
    </>
  );
}
