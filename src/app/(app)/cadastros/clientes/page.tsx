import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { requireFeature } from "@/lib/features";
import { Badge, Card, EmptyState, SearchBar, param } from "@/components/ui/primitives";
import { CustomerForm } from "@/components/simple-forms";
import { RowActions } from "@/components/row-actions";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("CADASTROS");
  await requireFeature("CLIENTES");
  const sp = await searchParams;
  const edit = param(sp.edit);
  const q = (param(sp.q) ?? "").trim().slice(0, 80);
  const customers = await db.customer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 300,
  });
  const editing = canEdit ? customers.find((c) => c.id === edit) : undefined;

  return (
    <div className="space-y-5">
      {canEdit && (
        <Card title={editing ? "Editar cliente" : "Novo cliente"} description="Cadastre quem faz encomendas e pedidos de entrega para reaproveitar os dados.">
          <CustomerForm initial={editing ? { id: editing.id, name: editing.name, phone: editing.phone ?? "", note: editing.note ?? "" } : undefined} />
        </Card>
      )}
      <SearchBar action="/cadastros/clientes" q={q} placeholder="Buscar por nome ou telefone…" />
      {customers.length === 0 ? (
        <EmptyState title="Nenhum cliente" description="Cadastre clientes para agilizar pedidos de entrega e encomendas." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Telefone</th><th>Observação</th><th></th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className={c.active ? undefined : "opacity-60"}>
                  <td className="font-medium">{c.name} {!c.active && <Badge>Inativo</Badge>}</td>
                  <td>{c.phone ?? "—"}</td><td className="max-w-64 truncate text-muted">{c.note ?? "—"}</td>
                  <td><RowActions entity="cliente" id={c.id} active={c.active} editHref={`/cadastros/clientes?edit=${c.id}`} canEdit={canEdit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
