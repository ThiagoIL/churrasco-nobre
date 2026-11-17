import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ChefHat, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth";
import { periodTotals } from "@/lib/finance-queries";
import { resolvePeriod } from "@/lib/period";
import { dateOnlyToString, formatDate, todayString, weekdayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { stockLevel } from "@/lib/rules/stock";
import { Amount, Card, PageHeader, PeriodFilter, Stat, param } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getAccess();
  const sp = await searchParams;
  const today = todayString();
  const period = resolvePeriod({ p: param(sp.p), de: param(sp.de), ate: param(sp.ate) }, today);
  const lv = access.levels;
  const finance = lv.FINANCEIRO !== "NONE";

  const [totals, recent, openOrders, tracked] = await Promise.all([
    finance ? periodTotals(period.from, period.to, today) : null,
    finance ? db.financialEntry.findMany({ where: { status: { in: ["PAID", "PENDING"] } }, orderBy: { createdAt: "desc" }, take: 5, include: { category: { select: { name: true } } } }) : [],
    lv.PEDIDOS !== "NONE" ? db.order.count({ where: { status: "OPEN" } }) : 0,
    lv.ESTOQUE !== "NONE" ? db.item.findMany({ where: { active: true, trackStock: true }, select: { stockQtyMilli: true, minStockMilli: true } }) : [],
  ]);
  const stockAlerts = tracked.filter((i) => stockLevel(i.stockQtyMilli, i.minStockMilli) !== "ok").length;

  const quick = [
    { href: "/pedidos/novo", label: "Novo pedido", icon: ChefHat, show: lv.PEDIDOS === "EDIT", primary: true },
    { href: "/financeiro/novo?tipo=receita", label: "Nova receita", icon: ArrowDownToLine, show: lv.FINANCEIRO === "EDIT" },
    { href: "/financeiro/novo?tipo=despesa", label: "Nova despesa", icon: ArrowUpFromLine, show: lv.FINANCEIRO === "EDIT" },
    { href: "/compras/nova", label: "Nova compra", icon: ReceiptText, show: lv.COMPRAS === "EDIT" },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader title={`Olá, ${access.user.name.split(" ")[0]}!`} description={`${weekdayLabel(today)}, ${formatDate(today)}`.replace(/^./, (c) => c.toUpperCase())} />

      {param(sp.acesso) === "negado" && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">Seu perfil não tem acesso a essa tela. Fale com o administrador se precisar.</p>
      )}

      {quick.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quick.map(({ href, label, icon: Icon, primary }) => (
            <Link key={href} href={href} className={`btn btn-lg h-auto min-h-20 flex-col gap-1.5 rounded-xl ${primary ? "btn-primary" : "btn-outline"}`}>
              <Icon className="size-6" /> {label}
            </Link>
          ))}
        </div>
      )}

      {totals && (
        <>
          <PeriodFilter basePath="/" period={period} />
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat size="lg" label="Faturado" value={formatMoney(totals.income)} tone="good" hint={`A receber: ${formatMoney(totals.receivable)}`} href={`/financeiro?p=${period.key}&tipo=receita`} />
            <Stat size="lg" label="Gasto" value={formatMoney(totals.expense)} tone="bad" hint={`A pagar: ${formatMoney(totals.payable)}`} href={`/financeiro?p=${period.key}&tipo=despesa`} />
            <Stat size="lg" label="Saldo" value={formatMoney(totals.balance)} tone={totals.balance >= 0 ? "good" : "bad"} hint="Recebido − pago" href="/financeiro/fluxo" />
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {(lv.PEDIDOS !== "NONE" || lv.ESTOQUE !== "NONE") && (
          <Card title="Atenção">
            <ul className="space-y-3 text-sm">
              {lv.PEDIDOS !== "NONE" && <li className="flex items-center justify-between"><span>Pedidos abertos</span><Link href="/pedidos" className="font-semibold text-brand-700 underline">{openOrders}</Link></li>}
              {lv.ESTOQUE !== "NONE" && <li className="flex items-center justify-between"><span>Itens com estoque em alerta</span><Link href="/estoque?sit=alerta" className={`font-semibold underline ${stockAlerts ? "text-expense" : "text-brand-700"}`}>{stockAlerts}</Link></li>}
              {totals && (totals.overduePayable > 0 || totals.overdueReceivable > 0) && (
                <li className="flex items-center justify-between"><span>Vencidos em aberto</span><Link href="/financeiro?status=pendentes" className="font-semibold text-expense underline">{formatMoney(totals.overduePayable + totals.overdueReceivable)}</Link></li>
              )}
            </ul>
          </Card>
        )}

        {finance && (
          <Card title="Últimos lançamentos" className="lg:col-span-2" padded={false}>
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Nenhum lançamento ainda. Comece lançando uma receita ou despesa.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((e) => (
                  <li key={e.id}>
                    <Link href={`/financeiro/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-gold-50/60">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.description}</span>
                        <span className="text-xs text-muted">{formatDate(dateOnlyToString(e.date))} · {e.category.name}{e.status === "PENDING" ? " · pendente" : ""}</span>
                      </span>
                      <Amount value={`${e.kind === "EXPENSE" ? "− " : ""}${formatMoney(e.amountCents)}`} kind={e.kind} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
