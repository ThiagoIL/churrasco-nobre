import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { catalogItems } from "@/lib/catalog";
import { PageHeader } from "@/components/ui/primitives";
import { OrderForm } from "@/app/(app)/pedidos/order-form";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function NewOrderPage() {
  await requireModule("PEDIDOS", "EDIT");
  const [items, customers] = await Promise.all([
    catalogItems({ sellable: true }),
    db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Novo pedido" back={{ href: "/pedidos", label: "Pedidos" }} />
      <div className="max-w-5xl"><OrderForm items={items} customers={customers} /></div>
    </>
  );
}
