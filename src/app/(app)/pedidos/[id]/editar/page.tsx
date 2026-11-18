import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { catalogItems } from "@/lib/catalog";
import { featureOn } from "@/lib/features";
import { localParts } from "@/lib/dates";
import { qtyToInput } from "@/lib/money";
import { orderTitle } from "@/lib/order-utils";
import { PageHeader } from "@/components/ui/primitives";
import { OrderForm } from "@/app/(app)/pedidos/order-form";

export const metadata: Metadata = { title: "Editar pedido" };
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("PEDIDOS", "EDIT");
  const { id } = await params;
  if (!uuidRe.test(id)) notFound();
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();
  if (order.status !== "OPEN") redirect(`/pedidos/${id}`);

  const customersEnabled = await featureOn("CLIENTES");
  const [items, customers] = await Promise.all([
    catalogItems({ sellable: true }),
    customersEnabled ? db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  // itens do pedido que saíram de venda continuam disponíveis para edição
  const known = new Set(items.map((i) => i.id));
  const missing = order.items.filter((l) => !known.has(l.itemId));
  if (missing.length) {
    const extra = await db.item.findMany({ where: { id: { in: missing.map((m) => m.itemId) } } });
    for (const i of extra) items.push({ id: i.id, name: i.name, unit: i.unit, groupName: i.groupName, code: i.code, priceCents: i.priceCents, costCents: i.costCents, stockMilli: i.stockQtyMilli, trackStock: i.trackStock });
  }

  const sched = order.scheduledFor ? localParts(order.scheduledFor) : null;
  return (
    <>
      <PageHeader title="Editar pedido" description={orderTitle(order)} back={{ href: `/pedidos/${id}`, label: "Pedido" }} />
      <div className="max-w-5xl">
        <OrderForm
          items={items} customers={customers} customersEnabled={customersEnabled}
          initial={{
            id: order.id, channel: order.channel, tableLabel: order.tableLabel ?? "", customerId: order.customerId ?? "",
            customerName: order.customerName ?? "", phone: order.phone ?? "", address: order.address ?? "",
            scheduledFor: sched ? `${sched.date}T${sched.time}` : "", note: order.note ?? "",
            lines: order.items.map((l) => ({ itemId: l.itemId, qty: qtyToInput(l.qtyMilli) })),
          }}
        />
      </div>
    </>
  );
}
