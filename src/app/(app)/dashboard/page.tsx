import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { dashboardData, variation } from "@/lib/dashboard-queries";
import { resolvePeriod } from "@/lib/period";
import { todayString } from "@/lib/dates";
import { formatMoney, formatQty } from "@/lib/money";
import { ORDER_CHANNEL_LABELS } from "@/lib/labels";
import { Card, PageHeader, PeriodFilter, Stat, param } from "@/components/ui/primitives";
import { HBars, IncomeExpenseChart } from "@/components/charts";
import { StockBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireModule("DASHBOARD");
  const sp = await searchParams;
  const today = todayString();
  const period = resolvePeriod({ p: param(sp.p), de: param(sp.de), ate: param(sp.ate) }, today);
  const d = await dashboardData(period, today);
  const { totals, prevTotals } = d;
  const vs = (cur: number, prev: number) => {
    const v = variation(cur, prev);
    return v ? `${v} vs. período anterior` : "Sem período anterior para comparar";
  };
  const margin = totals.income > 0 ? Math.round((totals.balance / totals.income) * 100) : null;

  return (
    <>
      <PageHeader title="Dashboard" description="Os números do restaurante no período escolhido." />
      <PeriodFilter basePath="/dashboard" period={period} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturado" value={formatMoney(totals.income)} tone="good" hint={vs(totals.income, prevTotals.income)} />
        <Stat label="Gasto" value={formatMoney(totals.expense)} tone="bad" hint={vs(totals.expense, prevTotals.expense)} />
        <Stat label="Saldo" value={formatMoney(totals.balance)} tone={totals.balance >= 0 ? "good" : "bad"} hint={margin === null ? undefined : `Margem de ${margin}% sobre o faturado`} />
        <Stat label="Ticket médio" value={formatMoney(d.paidOrders ? Math.round(d.salesTotal / d.paidOrders) : 0)} hint={`${d.paidOrders} ${d.paidOrders === 1 ? "pedido pago" : "pedidos pagos"}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={d.monthly ? "Receitas e despesas por mês" : "Receitas e despesas por dia"} className="lg:col-span-2">
          {d.points.length === 0 ? <p className="py-6 text-center text-sm text-muted">Sem movimento no período.</p> : <IncomeExpenseChart points={d.points} />}
        </Card>

        <Card title="A receber e a pagar" description="Pendentes do período">
          <dl className="space-y-4 text-sm">
            <div className="flex items-baseline justify-between"><dt>A receber</dt><dd className="text-lg font-semibold tabular-nums text-income">{formatMoney(totals.receivable)}</dd></div>
            <div className="flex items-baseline justify-between"><dt>A pagar</dt><dd className="text-lg font-semibold tabular-nums text-expense">{formatMoney(totals.payable)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-line pt-3"><dt>Vencido a pagar</dt><dd className="font-semibold tabular-nums">{formatMoney(totals.overduePayable)}</dd></div>
            <div className="flex items-baseline justify-between"><dt>Vencido a receber</dt><dd className="font-semibold tabular-nums">{formatMoney(totals.overdueReceivable)}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted">Pedidos abertos agora: <Link href="/pedidos" className="font-medium text-brand-700 underline">{d.openOrders}</Link></p>
        </Card>

        <Card title="Despesas por categoria"><HBars rows={d.expenseByCategory} /></Card>
        <Card title="Receitas por categoria"><HBars rows={d.incomeByCategory} tone="income" /></Card>
        <Card title="Recebido por forma de pagamento"><HBars rows={d.incomeByMethod} tone="gold" /></Card>

        <Card title="Itens mais vendidos"><HBars rows={d.topItems} tone="gold" empty="Nenhum pedido pago no período." /></Card>
        <Card title="Vendas por tipo de pedido">
          <HBars
            rows={d.byChannel.map((c) => ({ label: ORDER_CHANNEL_LABELS[c.channel], value: c.total, hint: `${c.count} ${c.count === 1 ? "pedido" : "pedidos"}` })).sort((a, b) => b.value - a.value)}
            tone="income" empty="Nenhum pedido pago no período."
          />
        </Card>
        <Card title="Compras por fornecedor"><HBars rows={d.purchasesBySupplier} empty="Nenhuma compra no período." /></Card>

        <Card title={`Estoque em alerta (${d.stockAlertCount})`} className="lg:col-span-3" padded={false}>
          {d.stockAlerts.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">Nenhum item abaixo do mínimo.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.stockAlerts.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{formatQty(i.stockQtyMilli)} {i.unit}{i.minStockMilli ? <span className="text-xs text-muted"> / mín. {formatQty(i.minStockMilli)}</span> : null}</span>
                    <StockBadge balance={i.stockQtyMilli} min={i.minStockMilli} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
