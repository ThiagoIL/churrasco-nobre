import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { entryWhere, periodTotals } from "@/lib/finance-queries";
import { parseEntryParams } from "@/lib/entry-params";
import { periodQuery } from "@/lib/period";
import { formatDate, dateOnlyToString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ENTRY_SOURCE_LABELS } from "@/lib/labels";
import {
  Amount, EmptyState, FilterBar, FilterField, LinkButton, LinkTabs, PageHeader, Pagination, PeriodFilter, SearchBar, Stat,
} from "@/components/ui/primitives";
import { ButtonForm } from "@/components/ui/form-kit";
import { EntryStatusBadge, KindBadge } from "@/components/status-badges";
import { payEntryAction } from "@/app/(app)/financeiro/actions";

export const metadata: Metadata = { title: "Financeiro" };

const PAGE_SIZE = 30;

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const { period, today, tipo, status, cat, q, page, filters } = parseEntryParams(sp);

  const where = entryWhere(filters);
  const [totals, total, entries, categories] = await Promise.all([
    periodTotals(period.from, period.to, today),
    db.financialEntry.count({ where }),
    db.financialEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true } }, paymentMethod: { select: { name: true } } },
    }),
    db.financialCategory.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);

  const baseParams = { tipo, status, cat, q: q || undefined };
  const keep = { p: period.key, de: period.key === "periodo" ? period.from : undefined, ate: period.key === "periodo" ? period.to : undefined, ...baseParams };
  const csv = new URLSearchParams(Object.entries(keep).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receitas e despesas lançadas, com o que já foi recebido ou pago e o que ainda está pendente."
        actions={
          canEdit && (
            <>
              <LinkButton href="/financeiro/novo?tipo=receita" variant="primary"><ArrowDownToLine className="size-4" /> Receita</LinkButton>
              <LinkButton href="/financeiro/novo?tipo=despesa" variant="outline"><ArrowUpFromLine className="size-4" /> Despesa</LinkButton>
            </>
          )
        }
      />
      <LinkTabs tabs={[
        { href: "/financeiro", label: "Lançamentos", active: true },
        { href: `/financeiro/fluxo?${periodQuery(period)}`, label: "Fluxo de caixa", active: false },
      ]} />

      <PeriodFilter basePath="/financeiro" period={period} params={baseParams} />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Faturado" value={formatMoney(totals.income)} tone="good" hint={`A receber: ${formatMoney(totals.receivable)}`} />
        <Stat label="Gasto" value={formatMoney(totals.expense)} tone="bad" hint={`A pagar: ${formatMoney(totals.payable)}`} />
        <Stat label="Saldo" value={formatMoney(totals.balance)} tone={totals.balance >= 0 ? "good" : "bad"} hint="Recebido − pago no período" />
      </div>
      {(totals.overdueReceivable > 0 || totals.overduePayable > 0) && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Vencidos em aberto (todas as datas):{" "}
          {totals.overduePayable > 0 && <strong>{formatMoney(totals.overduePayable)} a pagar</strong>}
          {totals.overduePayable > 0 && totals.overdueReceivable > 0 && " · "}
          {totals.overdueReceivable > 0 && <strong>{formatMoney(totals.overdueReceivable)} a receber</strong>}
          . <Link className="underline" href={`/financeiro?p=mes&status=pendentes`}>Ver pendentes</Link>
        </p>
      )}

      <FilterBar action="/financeiro">
        <input type="hidden" name="p" value={period.key} />
        {period.key === "periodo" && <><input type="hidden" name="de" value={period.from} /><input type="hidden" name="ate" value={period.to} /></>}
        <FilterField label="Tipo">
          <select name="tipo" defaultValue={tipo ?? ""} className="input">
            <option value="">Todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option>
          </select>
        </FilterField>
        <FilterField label="Situação">
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">Pagos e pendentes</option><option value="pagos">Só pagos/recebidos</option><option value="pendentes">Só pendentes</option><option value="cancelados">Cancelados</option>
          </select>
        </FilterField>
        <FilterField label="Categoria">
          <select name="cat" defaultValue={cat ?? ""} className="input">
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.kind === "INCOME" ? "Receita" : "Despesa"} · {c.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Buscar" className="min-w-52 flex-1">
          <input type="search" name="q" defaultValue={q} placeholder="Descrição ou observação" className="input" />
        </FilterField>
      </FilterBar>

      <div className="mb-3 flex items-center justify-between gap-2 text-sm text-muted">
        <span>{total} {total === 1 ? "lançamento" : "lançamentos"}</span>
        <Link href={`/financeiro/exportar?${csv}`} className="btn btn-outline btn-sm" prefetch={false}><Download className="size-3.5" /> Exportar CSV</Link>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Nenhum lançamento neste filtro" description="Mude o período ou os filtros, ou faça um novo lançamento." action={canEdit && <LinkButton href="/financeiro/novo">Novo lançamento</LinkButton>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th className="text-right">Valor</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const date = dateOnlyToString(e.date);
                return (
                  <tr key={e.id} className={e.status === "CANCELED" ? "opacity-60" : undefined}>
                    <td className="whitespace-nowrap">{formatDate(date)}</td>
                    <td>
                      <Link href={`/financeiro/${e.id}`} className="font-medium hover:text-brand-700">{e.description}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <KindBadge kind={e.kind} />
                        {e.source !== "MANUAL" && <span className="text-xs text-muted">{ENTRY_SOURCE_LABELS[e.source]}</span>}
                      </div>
                    </td>
                    <td>{e.category.name}</td>
                    <td className="text-muted">{e.paymentMethod?.name ?? "—"}</td>
                    <td className="text-right"><Amount value={`${e.kind === "EXPENSE" ? "− " : ""}${formatMoney(e.amountCents)}`} kind={e.kind} /></td>
                    <td><EntryStatusBadge kind={e.kind} status={e.status} overdue={date < today} /></td>
                    <td className="text-right">
                      {canEdit && e.status === "PENDING" && (
                        <ButtonForm action={payEntryAction} fields={{ id: e.id, date: today }} confirm={`${e.kind === "INCOME" ? "Marcar como recebido" : "Marcar como pago"} hoje?`}>
                          {e.kind === "INCOME" ? "Receber" : "Pagar"}
                        </ButtonForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/financeiro" params={keep} />
    </>
  );
}
