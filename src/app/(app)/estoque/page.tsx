import type { Metadata } from "next";
import Link from "next/link";
import { Download, MinusCircle, PlusCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { lineTotal, formatMoney, formatQty, qtyToInput } from "@/lib/money";
import { stockLevel } from "@/lib/rules/stock";
import { EmptyState, FilterBar, FilterField, LinkButton, LinkTabs, PageHeader, Pagination, Stat, param } from "@/components/ui/primitives";
import { StockBadge } from "@/components/status-badges";
import { MinStockForm } from "@/app/(app)/estoque/min-stock-form";

export const metadata: Metadata = { title: "Estoque" };
const PAGE_SIZE = 40;

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("ESTOQUE");
  const sp = await searchParams;
  const q = (param(sp.q) ?? "").trim().slice(0, 80);
  const grupo = (param(sp.grupo) ?? "").slice(0, 40);
  const sit = ["alerta", "baixo", "zerado", "negativo"].includes(param(sp.sit) ?? "") ? param(sp.sit)! : "";
  const page = Math.max(1, Math.min(10_000, Number(param(sp.page)) || 1));

  // o cadastro é pequeno (centenas de itens): filtramos por situação em memória, pois depende de comparar duas colunas
  const all = await db.item.findMany({
    where: {
      active: true, trackStock: true,
      ...(grupo ? { groupName: grupo } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: 3000,
  });
  const groups = [...new Set((await db.item.findMany({ where: { active: true, trackStock: true, groupName: { not: null } }, select: { groupName: true } })).map((g) => g.groupName!))].sort();

  const withLevel = all.map((i) => ({ ...i, level: stockLevel(i.stockQtyMilli, i.minStockMilli) }));
  const alerts = withLevel.filter((i) => i.level !== "ok");
  const filtered = withLevel.filter((i) =>
    sit === "" ? true : sit === "alerta" ? i.level !== "ok" : sit === "baixo" ? i.level === "low" : sit === "zerado" ? i.level === "zero" : i.level === "negative",
  );
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stockValue = all.reduce((s, i) => s + (i.stockQtyMilli > 0 ? lineTotal(i.costCents, i.stockQtyMilli) : 0), 0);

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Saldo atual de cada item. Compras entram, vendas e consumo saem. O estoque mínimo se define aqui."
        actions={canEdit && <><LinkButton href="/estoque/saida#saldo-inicial" variant="outline"><PlusCircle className="size-4" /> Saldo inicial</LinkButton><LinkButton href="/estoque/saida" variant="primary"><MinusCircle className="size-4" /> Lançar consumo / perda</LinkButton></>}
      />

      <LinkTabs tabs={[{ href: "/estoque", label: "Saldo dos itens", active: true }, { href: "/estoque/movimentacoes", label: "Movimentações", active: false }, ...(canEdit ? [{ href: "/estoque/saida", label: "Consumo, perda e ajuste", active: false }] : [])]} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Itens controlados" value={String(all.length)} />
        <Stat label="Valor em estoque" value={formatMoney(stockValue)} hint="Pelo último custo" />
        <Stat label="Abaixo do mínimo" value={String(alerts.filter((i) => i.level === "low").length)} tone={alerts.some((i) => i.level === "low") ? "warn" : "default"} href="/estoque?sit=baixo" />
        <Stat label="Zerados / negativos" value={String(alerts.filter((i) => i.level === "zero" || i.level === "negative").length)} tone={alerts.some((i) => i.level === "zero" || i.level === "negative") ? "bad" : "default"} href="/estoque?sit=alerta" />
      </div>

      <FilterBar action="/estoque">
        <FilterField label="Buscar" className="min-w-52 flex-1"><input type="search" name="q" defaultValue={q} placeholder="Nome do item" className="input" /></FilterField>
        <FilterField label="Grupo"><select name="grupo" defaultValue={grupo} className="input"><option value="">Todos</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}</select></FilterField>
        <FilterField label="Situação">
          <select name="sit" defaultValue={sit} className="input">
            <option value="">Todos</option><option value="alerta">Com alerta</option><option value="baixo">Abaixo do mínimo</option><option value="zerado">Zerados</option><option value="negativo">Negativos</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="mb-3 flex justify-between gap-2 text-sm text-muted">
        <span>{filtered.length} {filtered.length === 1 ? "item" : "itens"}</span>
        <Link href="/estoque/exportar" className="btn btn-outline btn-sm" prefetch={false}><Download className="size-3.5" /> Exportar CSV</Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum item" description="Itens com “controla estoque” ligado em Cadastros aparecem aqui." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>Grupo</th><th className="text-right">Saldo</th><th className="text-right">Mínimo</th><th className="text-right">Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium"><Link href={`/estoque/movimentacoes?item=${i.id}`} className="hover:text-brand-700">{i.name}</Link></td>
                  <td className="text-muted">{i.groupName ?? "—"}</td>
                  <td className="text-right font-medium tabular-nums">{formatQty(i.stockQtyMilli)}</td>
                  <td className="text-right tabular-nums">{canEdit ? <MinStockForm itemId={i.id} itemName={i.name} value={i.minStockMilli ? qtyToInput(i.minStockMilli) : ""} /> : <span className="text-muted">{i.minStockMilli ? formatQty(i.minStockMilli) : "—"}</span>}</td>
                  <td className="text-right tabular-nums">{formatMoney(i.stockQtyMilli > 0 ? lineTotal(i.costCents, i.stockQtyMilli) : 0)}</td>
                  <td><StockBadge balance={i.stockQtyMilli} min={i.minStockMilli} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} basePath="/estoque" params={{ q: q || undefined, grupo: grupo || undefined, sit: sit || undefined }} />
    </>
  );
}
