import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { catalogItems, selectOptions } from "@/lib/catalog";
import { SYSTEM_CATEGORIES } from "@/lib/system-categories";
import { todayString } from "@/lib/dates";
import { PageHeader } from "@/components/ui/primitives";
import { PurchaseForm } from "@/app/(app)/compras/purchase-form";

export const metadata: Metadata = { title: "Nova compra" };

export default async function NewPurchasePage() {
  await requireModule("COMPRAS", "EDIT");
  const [items, { categories, methods, suppliers }, defaultCategory] = await Promise.all([
    catalogItems({ purchasable: true }),
    selectOptions(),
    db.financialCategory.findFirst({ where: { isSystem: true, kind: SYSTEM_CATEGORIES.PURCHASES.kind, name: SYSTEM_CATEGORIES.PURCHASES.name } }),
  ]);
  const expense = categories.filter((c) => c.kind === "EXPENSE");
  return (
    <>
      <PageHeader title="Nova compra" back={{ href: "/compras", label: "Compras" }} description="O que você comprar entra no estoque e vira despesa automaticamente." />
      <div className="max-w-4xl">
        <PurchaseForm items={items} suppliers={suppliers} categories={expense} methods={methods} defaultCategoryId={defaultCategory?.id ?? expense[0]?.id ?? ""} today={todayString()} />
      </div>
    </>
  );
}
