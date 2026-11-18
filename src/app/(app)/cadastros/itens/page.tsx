import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { formatMoney, formatQty } from "@/lib/money";
import { Badge, EmptyState, FilterBar, FilterField, LinkButton, Pagination, param } from "@/components/ui/primitives";
import { RowActions } from "@/components/row-actions";

export const metadata: Metadata = { title: "Itens e valores" };
const PAGE_SIZE = 40;

export default async function ItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("CADASTROS");
  const sp = await searchParams;
  const q = (param(sp.q) ?? "").trim().slice(0, 80);
  const uso = ["compra", "venda"].includes(param(sp.uso) ?? "") ? param(sp.uso) : undefined;
  const situacao = ["ativos", "inativos"].includes(param(sp.situacao) ?? "") ? param(sp.situacao) : "ativos";
  const grupo = (param(sp.grupo) ?? "").slice(0, 40);
  const page = Math.max(1, Math.min(10_000, Number(param(sp.page)) || 1));

  const where: Prisma.ItemWhereInput = {
    active: situacao === "ativos" ? true : false,
    ...(uso === "compra" ? { purchasable: true } : uso === "venda" ? { sellable: true } : {}),
    ...(grupo ? { groupName: grupo } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  const [total, items, groups] = await Promise.all([
    db.item.count({ where }),
    db.item.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.item.findMany({ where: { groupName: { not: null } }, distinct: ["groupName"], select: { groupName: true }, orderBy: { groupName: "asc" } }),
  ]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Itens e valores</h2>
        {canEdit && <LinkButton href="/cadastros/itens/novo"><Plus className="size-4" /> Novo item</LinkButton>}
      </div>

      <FilterBar action="/cadastros/itens">
        <FilterField label="Buscar" className="min-w-52 flex-1"><input type="search" name="q" defaultValue={q} placeholder="Nome do item" className="input" /></FilterField>
        <FilterField label="Uso">
          <select name="uso" defaultValue={uso ?? ""} className="input"><option value="">Todos</option><option value="compra">Para compra</option><option value="venda">Para venda</option></select>
        </FilterField>
        <FilterField label="Grupo">
          <select name="grupo" defaultValue={grupo} className="input"><option value="">Todos</option>{groups.map((g) => <option key={g.groupName} value={g.groupName!}>{g.groupName}</option>)}</select>
        </FilterField>
        <FilterField label="Situação">
          <select name="situacao" defaultValue={situacao} className="input"><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select>
        </FilterField>
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState title="Nenhum item encontrado" description="Cadastre os itens que você compra (insumos) e vende (cardápio) com seus valores." action={canEdit && <LinkButton href="/cadastros/itens/novo">Cadastrar item</LinkButton>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>Grupo</th><th>Uso</th><th className="text-right">Custo</th><th className="text-right">Preço de venda</th><th className="text-right">Estoque</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={i.active ? undefined : "opacity-60"}>
                  <td><Link href={`/cadastros/itens/${i.id}`} className="font-medium hover:text-brand-700">{i.name}</Link></td>
                  <td className="text-muted">{i.groupName ?? "—"}</td>
                  <td className="space-x-1">{i.purchasable && <Badge tone="blue">Compra</Badge>}{i.sellable && <Badge tone="gold">Venda</Badge>}</td>
                  <td className="text-right tabular-nums">{formatMoney(i.costCents)}</td>
                  <td className="text-right tabular-nums">{i.sellable ? formatMoney(i.priceCents) : "—"}</td>
                  <td className="text-right tabular-nums">{i.trackStock ? formatQty(i.stockQtyMilli) : <span className="text-muted">não controla</span>}</td>
                  <td><RowActions entity="item" id={i.id} active={i.active} editHref={`/cadastros/itens/${i.id}`} canEdit={canEdit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/cadastros/itens" params={{ q: q || undefined, uso, grupo: grupo || undefined, situacao }} />
    </>
  );
}
