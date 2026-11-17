import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Card } from "@/components/ui/primitives";
import { ItemForm } from "@/app/(app)/cadastros/itens/item-form";

export const metadata: Metadata = { title: "Novo item" };

export default async function NewItemPage() {
  await requireModule("CADASTROS", "EDIT");
  const groups = (await db.item.findMany({ where: { groupName: { not: null } }, distinct: ["groupName"], select: { groupName: true }, orderBy: { groupName: "asc" } })).map((g) => g.groupName!);
  return (
    <div className="max-w-4xl">
      <Card title="Novo item" description="Cadastre o que você compra, o que vende ou os dois.">
        <ItemForm groups={groups} />
      </Card>
    </div>
  );
}
