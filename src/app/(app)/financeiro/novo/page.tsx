import type { Metadata } from "next";
import { requireModule } from "@/lib/auth";
import { selectOptions } from "@/lib/catalog";
import { todayString } from "@/lib/dates";
import { PageHeader, param } from "@/components/ui/primitives";
import { EntryForm } from "@/app/(app)/financeiro/entry-form";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireModule("FINANCEIRO", "EDIT");
  const tipo = param((await searchParams).tipo);
  const { categories, methods, suppliers, customers } = await selectOptions();
  return (
    <>
      <PageHeader title="Novo lançamento" back={{ href: "/financeiro", label: "Financeiro" }} description="Receita ou despesa: informe o valor, uma descrição e a categoria." />
      <div className="max-w-3xl">
        <EntryForm
          categories={categories}
          methods={methods}
          suppliers={suppliers}
          customers={customers}
          initialKind={tipo === "despesa" ? "EXPENSE" : "INCOME"}
          today={todayString()}
        />
      </div>
    </>
  );
}
