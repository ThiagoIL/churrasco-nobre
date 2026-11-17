import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, param } from "@/components/ui/primitives";
import { CategoryForm } from "@/components/simple-forms";
import { RowActions } from "@/components/row-actions";

export const metadata: Metadata = { title: "Categorias financeiras" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("CADASTROS");
  const edit = param((await searchParams).edit);
  const categories = await db.financialCategory.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
  const editing = canEdit ? categories.find((c) => c.id === edit && !c.isSystem) : undefined;

  return (
    <div className="space-y-5">
      {canEdit && (
        <Card title={editing ? "Editar categoria" : "Nova categoria"} description="Usadas para classificar receitas e despesas nos lançamentos e no dashboard.">
          <CategoryForm initial={editing ? { id: editing.id, name: editing.name, kind: editing.kind } : undefined} />
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(["INCOME", "EXPENSE"] as const).map((kind) => (
          <Card key={kind} title={kind === "INCOME" ? "Receitas" : "Despesas"} padded={false}>
            <ul className="divide-y divide-line">
              {categories.filter((c) => c.kind === kind).map((c) => (
                <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${c.active ? "" : "opacity-60"}`}>
                  <span className="flex items-center gap-2 text-sm font-medium">{c.name}{c.isSystem && <Badge tone="gold">Sistema</Badge>}{!c.active && <Badge>Inativa</Badge>}</span>
                  <RowActions entity="categoria" id={c.id} active={c.active} editHref={`/cadastros/categorias?edit=${c.id}`} locked={c.isSystem} canEdit={canEdit} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
