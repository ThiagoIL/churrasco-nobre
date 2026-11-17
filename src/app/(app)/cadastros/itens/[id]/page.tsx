import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { centsToInput, formatQty, qtyToInput } from "@/lib/money";
import { Card } from "@/components/ui/primitives";
import { ItemForm } from "@/app/(app)/cadastros/itens/item-form";

export const metadata: Metadata = { title: "Editar item" };
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("CADASTROS", "EDIT");
  const { id } = await params;
  if (!uuidRe.test(id)) notFound();
  const [item, groups] = await Promise.all([
    db.item.findUnique({ where: { id } }),
    db.item.findMany({ where: { groupName: { not: null } }, distinct: ["groupName"], select: { groupName: true }, orderBy: { groupName: "asc" } }),
  ]);
  if (!item) notFound();
  return (
    <div className="max-w-4xl">
      <Card title={item.name} description={item.trackStock ? `Saldo em estoque: ${formatQty(item.stockQtyMilli)} ${item.unit}. O saldo muda por compras, vendas, consumo e ajustes (em Estoque).` : undefined}>
        <ItemForm
          groups={groups.map((g) => g.groupName!)}
          initial={{
            id: item.id, name: item.name, code: item.code ?? "", unit: item.unit, groupName: item.groupName ?? "",
            purchasable: item.purchasable, sellable: item.sellable, trackStock: item.trackStock,
            cost: item.costCents ? centsToInput(item.costCents) : "", price: item.priceCents ? centsToInput(item.priceCents) : "",
            minStock: item.minStockMilli ? qtyToInput(item.minStockMilli) : "", active: item.active, note: item.note ?? "",
          }}
        />
      </Card>
    </div>
  );
}
