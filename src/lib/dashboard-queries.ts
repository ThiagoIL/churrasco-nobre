import "server-only";
import { db } from "@/lib/db";
import { addDays, dateOnly, diffDays, endOfDayInstant, formatShortDate, monthLabel, startOfDayInstant } from "@/lib/dates";
import { dailyFlow, periodTotals } from "@/lib/finance-queries";
import { previousPeriod, type Period } from "@/lib/period";
import { stockLevel } from "@/lib/rules/stock";
import type { BarPoint, BarRow } from "@/components/charts";

const range = (from: string, to: string) => ({ gte: dateOnly(from), lte: dateOnly(to) });

export async function dashboardData(period: Period, today: string) {
  const prev = previousPeriod(period);
  const [totals, prevTotals, flow] = await Promise.all([
    periodTotals(period.from, period.to, today),
    periodTotals(prev.from, prev.to, today),
    dailyFlow(period.from, period.to),
  ]);

  // série: por dia (até ~2 meses) ou por mês
  const monthly = diffDays(period.from, period.to) > 62;
  const points: BarPoint[] = [];
  if (monthly) {
    const byMonth = new Map<string, BarPoint>();
    for (const d of flow) {
      const key = d.date.slice(0, 7);
      const p = byMonth.get(key) ?? { label: monthLabel(key).slice(0, 3) + "/" + key.slice(2, 4), income: 0, expense: 0 };
      p.income += d.income;
      p.expense += d.expense;
      byMonth.set(key, p);
    }
    points.push(...[...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => p));
  } else {
    const map = new Map(flow.map((d) => [d.date, d]));
    for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
      const f = map.get(d);
      points.push({ label: formatShortDate(d), income: f?.income ?? 0, expense: f?.expense ?? 0 });
    }
  }

  const paidWhere = { date: range(period.from, period.to), status: "PAID" as const };
  const orderWhere = { status: "PAID" as const, paidAt: { gte: startOfDayInstant(period.from), lt: endOfDayInstant(period.to) } };

  const [expenseByCat, incomeByCat, incomeByMethod, topItems, byChannel, purchasesBySupplier, trackedItems, openOrders] = await Promise.all([
    db.financialEntry.groupBy({ by: ["categoryId"], where: { ...paidWhere, kind: "EXPENSE" }, _sum: { amountCents: true }, orderBy: { _sum: { amountCents: "desc" } }, take: 8 }),
    db.financialEntry.groupBy({ by: ["categoryId"], where: { ...paidWhere, kind: "INCOME" }, _sum: { amountCents: true }, orderBy: { _sum: { amountCents: "desc" } }, take: 8 }),
    db.financialEntry.groupBy({ by: ["paymentMethodId"], where: { ...paidWhere, kind: "INCOME" }, _sum: { amountCents: true }, orderBy: { _sum: { amountCents: "desc" } } }),
    db.orderItem.groupBy({ by: ["itemId", "name"], where: { order: orderWhere }, _sum: { totalCents: true, qtyMilli: true }, orderBy: { _sum: { totalCents: "desc" } }, take: 8 }),
    db.order.groupBy({ by: ["channel"], where: orderWhere, _sum: { totalCents: true }, _count: true }),
    db.purchase.groupBy({ by: ["supplierId"], where: { status: "RECEIVED", date: range(period.from, period.to) }, _sum: { totalCents: true }, orderBy: { _sum: { totalCents: "desc" } }, take: 6 }),
    db.item.findMany({ where: { active: true, trackStock: true }, select: { id: true, name: true, unit: true, stockQtyMilli: true, minStockMilli: true } }),
    db.order.count({ where: { status: "OPEN" } }),
  ]);

  const [categories, methods, suppliers] = await Promise.all([
    db.financialCategory.findMany({ select: { id: true, name: true } }),
    db.paymentMethod.findMany({ select: { id: true, name: true } }),
    db.supplier.findMany({ select: { id: true, name: true } }),
  ]);
  const name = (list: { id: string; name: string }[], id: string | null, fallback: string) => list.find((x) => x.id === id)?.name ?? fallback;

  const catRows = (rows: typeof expenseByCat): BarRow[] => rows.map((r) => ({ label: name(categories, r.categoryId, "—"), value: r._sum.amountCents ?? 0 }));
  const paidOrders = byChannel.reduce((s, c) => s + c._count, 0);
  const salesTotal = byChannel.reduce((s, c) => s + (c._sum.totalCents ?? 0), 0);

  const stockAlerts = trackedItems
    .map((i) => ({ ...i, level: stockLevel(i.stockQtyMilli, i.minStockMilli) }))
    .filter((i) => i.level !== "ok")
    .sort((a, b) => a.stockQtyMilli - b.stockQtyMilli);

  return {
    totals, prevTotals, points, monthly,
    expenseByCategory: catRows(expenseByCat),
    incomeByCategory: catRows(incomeByCat),
    incomeByMethod: incomeByMethod.map((r): BarRow => ({ label: name(methods, r.paymentMethodId, "Não informada"), value: r._sum.amountCents ?? 0 })),
    topItems: topItems.map((r): BarRow => ({ label: r.name, value: r._sum.totalCents ?? 0, hint: `× ${((r._sum.qtyMilli ?? 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}` })),
    byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count, total: c._sum.totalCents ?? 0 })),
    paidOrders, salesTotal,
    purchasesBySupplier: purchasesBySupplier.map((r): BarRow => ({ label: name(suppliers, r.supplierId, "Sem fornecedor"), value: r._sum.totalCents ?? 0 })),
    stockAlerts: stockAlerts.slice(0, 8), stockAlertCount: stockAlerts.length,
    openOrders,
  };
}

/** Variação percentual entre dois valores ("+12%"); null quando não há base de comparação. */
export function variation(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
