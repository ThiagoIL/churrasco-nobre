import type { Metadata } from "next";
import { Download } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { dailyFlow, openingBalance, periodTotals } from "@/lib/finance-queries";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { formatDate, formatShortDate, todayString, weekdayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Amount, EmptyState, LinkTabs, PageHeader, PeriodFilter, Stat, param } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const today = todayString();
  const period = resolvePeriod({ p: param(sp.p), de: param(sp.de), ate: param(sp.ate) }, today);

  const [days, opening, totals] = await Promise.all([
    dailyFlow(period.from, period.to),
    openingBalance(period.from),
    periodTotals(period.from, period.to, today),
  ]);

  let running = opening;
  const rows = days.map((d) => {
    running += d.income - d.expense;
    return { ...d, balance: d.income - d.expense, running };
  });
  const closing = opening + totals.balance;
  const projected = closing + totals.receivable - totals.payable;

  return (
    <>
      <PageHeader title="Fluxo de caixa" description="Entradas e saídas por dia, com o saldo acumulado e o que está previsto." />
      <LinkTabs tabs={[
        { href: `/financeiro?${periodQuery(period)}`, label: "Lançamentos", active: false },
        { href: "/financeiro/fluxo", label: "Fluxo de caixa", active: true },
      ]} />
      <PeriodFilter basePath="/financeiro/fluxo" period={period} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Saldo inicial" value={formatMoney(opening)} hint={`Até ${formatDate(period.from)}`} />
        <Stat label="Entradas" value={formatMoney(totals.income)} tone="good" />
        <Stat label="Saídas" value={formatMoney(totals.expense)} tone="bad" />
        <Stat label="Saldo final" value={formatMoney(closing)} tone={closing >= 0 ? "good" : "bad"} />
        <Stat label="Saldo previsto" value={formatMoney(projected)} tone={projected >= 0 ? "brand" : "bad"} hint="Com pendentes do período" />
      </div>

      <div className="mb-3 flex justify-end">
        <Link href={`/financeiro/exportar?${periodQuery(period)}&visao=fluxo`} className="btn btn-outline btn-sm" prefetch={false}><Download className="size-3.5" /> Exportar CSV</Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Sem movimento neste período" description="Os dias com receitas ou despesas aparecem aqui." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Dia</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo do dia</th>
                <th className="text-right">Saldo acumulado</th><th className="text-right">A receber</th><th className="text-right">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="whitespace-nowrap">
                    <span className="font-medium">{formatShortDate(r.date)}</span>{" "}
                    <span className="text-xs capitalize text-muted">{weekdayLabel(r.date).slice(0, 3)}</span>
                  </td>
                  <td className="text-right"><Amount value={r.income ? formatMoney(r.income) : "—"} kind={r.income ? "INCOME" : undefined} /></td>
                  <td className="text-right"><Amount value={r.expense ? formatMoney(r.expense) : "—"} kind={r.expense ? "EXPENSE" : undefined} /></td>
                  <td className="text-right"><Amount value={formatMoney(r.balance)} kind={r.balance === 0 ? undefined : r.balance > 0 ? "INCOME" : "EXPENSE"} /></td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(r.running)}</td>
                  <td className="text-right tabular-nums text-muted">{r.receivable ? formatMoney(r.receivable) : "—"}</td>
                  <td className="text-right tabular-nums text-muted">{r.payable ? formatMoney(r.payable) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
