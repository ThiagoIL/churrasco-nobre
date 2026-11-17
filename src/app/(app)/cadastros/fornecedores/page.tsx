import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, EmptyState, SearchBar, param } from "@/components/ui/primitives";
import { SupplierForm } from "@/components/simple-forms";
import { RowActions } from "@/components/row-actions";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("CADASTROS");
  const sp = await searchParams;
  const edit = param(sp.edit);
  const q = (param(sp.q) ?? "").trim().slice(0, 80);
  const suppliers = await db.supplier.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 300,
  });
  const editing = canEdit ? suppliers.find((s) => s.id === edit) : undefined;

  return (
    <div className="space-y-5">
      {canEdit && (
        <Card title={editing ? "Editar fornecedor" : "Novo fornecedor"}>
          <SupplierForm initial={editing ? { id: editing.id, name: editing.name, phone: editing.phone ?? "", document: editing.document ?? "", note: editing.note ?? "" } : undefined} />
        </Card>
      )}
      <SearchBar action="/cadastros/fornecedores" q={q} placeholder="Buscar fornecedor…" />
      {suppliers.length === 0 ? (
        <EmptyState title="Nenhum fornecedor" description="Cadastre quem vende para você: carnes, bebidas, gás, carvão…" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Telefone</th><th>CNPJ/CPF</th><th>Observação</th><th></th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className={s.active ? undefined : "opacity-60"}>
                  <td className="font-medium">{s.name} {!s.active && <Badge>Inativo</Badge>}</td>
                  <td>{s.phone ?? "—"}</td><td>{s.document ?? "—"}</td><td className="max-w-64 truncate text-muted">{s.note ?? "—"}</td>
                  <td><RowActions entity="fornecedor" id={s.id} active={s.active} editHref={`/cadastros/fornecedores?edit=${s.id}`} canEdit={canEdit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
