import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, EmptyState, param } from "@/components/ui/primitives";
import { TableForm } from "@/components/simple-forms";
import { RowActions } from "@/components/row-actions";

export const metadata: Metadata = { title: "Mesas e comandas" };

export default async function TablesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("CADASTROS");
  const edit = param((await searchParams).edit);
  const tables = await db.diningTable.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  // ordem "natural": Mesa 2 antes de Mesa 10
  tables.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const editing = canEdit ? tables.find((t) => t.id === edit) : undefined;

  return (
    <div className="max-w-3xl space-y-5">
      {canEdit && (
        <Card title={editing ? "Editar mesa ou comanda" : "Nova mesa ou comanda"}>
          <TableForm initial={editing ? { id: editing.id, name: editing.name } : undefined} />
        </Card>
      )}
      {tables.length === 0 ? (
        <EmptyState title="Nenhuma mesa ou comanda" description="Cadastre as mesas e comandas do salão: no pedido você escolhe uma delas." />
      ) : (
        <Card title="Mesas e comandas" padded={false}>
          <ul className="divide-y divide-line">
            {tables.map((t) => (
              <li key={t.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${t.active ? "" : "opacity-60"}`}>
                <span className="flex items-center gap-2 text-sm font-medium">{t.name}{!t.active && <Badge>Inativa</Badge>}</span>
                <RowActions entity="mesa" id={t.id} active={t.active} editHref={`/cadastros/mesas?edit=${t.id}`} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
