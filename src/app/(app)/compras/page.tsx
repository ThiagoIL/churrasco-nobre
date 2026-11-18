import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { featureOn } from "@/lib/features";
import { parsePurchaseParams } from "@/lib/purchase-params";
import { dateOnlyToString, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, PeriodFilter, Stat } from "@/components/ui/primitives";
import { PurchaseStatusBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Compras" };
const PAGE_SIZE = 30;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("COMPRAS");
  const suppliersOn = await featureOn("FORNECEDORES");
  const { period, supplier, status, q, page, where } = parsePurchaseParams(await searchParams, suppliersOn);

  const [total, purchases, suppliers, sums] = await Promise.all([
    db.purchase.count({ where }),
    db.purchase.findMany({
      where, orderBy: [{ date: "desc" }, { number: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    suppliersOn ? db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    db.purchase.aggregate({ where, _sum: { totalCents: true }, _count: true }),
  ]);

  const keep = { p: period.key, de: period.key === "periodo" ? period.from : undefined, ate: period.key === "periodo" ? period.to : undefined, fornecedor: supplier, status, q: q || undefined };
  const csv = new URLSearchParams(Object.entries(keep).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Compras"
        description="O que foi comprado: entra no estoque e vira despesa no financeiro."
        actions={canEdit && <LinkButton href="/compras/nova"><Plus className="size-4" /> Nova compra</LinkButton>}
      />
      <PeriodFilter basePath="/compras" period={period} params={{ fornecedor: supplier, status, q: q || undefined }} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-xl">
        <Stat label={status === "canceladas" ? "Canceladas" : "Total comprado"} value={formatMoney(sums._sum.totalCents ?? 0)} tone="bad" />
        <Stat label="Compras" value={String(sums._count)} />
      </div>

      <FilterBar action="/compras">
        <input type="hidden" name="p" value={period.key} />
        {period.key === "periodo" && <><input type="hidden" name="de" value={period.from} /><input type="hidden" name="ate" value={period.to} /></>}
        {suppliersOn && (
          <FilterField label="Fornecedor">
            <select name="fornecedor" defaultValue={supplier ?? ""} className="input"><option value="">Todos</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </FilterField>
        )}
        <FilterField label="Situação">
          <select name="status" defaultValue={status ?? ""} className="input"><option value="">Todas (exceto canceladas)</option><option value="pagas">Pagas</option><option value="apagar">A pagar</option><option value="canceladas">Canceladas</option></select>
        </FilterField>
        <FilterField label="Buscar" className="min-w-52 flex-1"><input type="search" name="q" defaultValue={q} placeholder={suppliersOn ? "Fornecedor, nota ou observação" : "Nota ou observação"} className="input" /></FilterField>
      </FilterBar>

      <div className="mb-3 flex justify-end">
        <Link href={`/compras/exportar?${csv}`} className="btn btn-outline btn-sm" prefetch={false}><Download className="size-3.5" /> Exportar CSV</Link>
      </div>

      {purchases.length === 0 ? (
        <EmptyState title="Nenhuma compra neste filtro" description="Registre o que você compra para controlar o estoque e as despesas." action={canEdit && <LinkButton href="/compras/nova">Registrar compra</LinkButton>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nº</th><th>Data</th>{suppliersOn && <th>Fornecedor</th>}<th>Itens</th><th className="text-right">Total</th><th>Situação</th></tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className={p.status === "CANCELED" ? "opacity-60" : undefined}>
                  <td><Link href={`/compras/${p.id}`} className="font-medium text-brand-700 hover:underline">#{p.number}</Link></td>
                  <td>{formatDate(dateOnlyToString(p.date))}</td>
                  {suppliersOn && <td>{p.supplier?.name ?? <span className="text-muted">—</span>}</td>}
                  <td>{p._count.items}</td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(p.totalCents)}</td>
                  <td><PurchaseStatusBadge status={p.status} paid={p.paid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/compras" params={keep} />
    </>
  );
}
