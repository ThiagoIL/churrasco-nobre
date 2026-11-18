import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { resolvePeriod } from "@/lib/period";
import { endOfDayInstant, formatDateTime, startOfDayInstant, todayString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { orderWho, timeAgo } from "@/lib/order-utils";
import { Card, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, PeriodFilter, Stat, param } from "@/components/ui/primitives";
import { ChannelBadge, OrderStatusBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Pedidos" };
const PAGE_SIZE = 30;
const CHANNELS = ["TABLE", "COUNTER", "DELIVERY", "CATERING"] as const;
const STATUSES = ["OPEN", "PAID", "CANCELED"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("PEDIDOS");
  const sp = await searchParams;
  const period = resolvePeriod({ p: param(sp.p) ?? "hoje", de: param(sp.de), ate: param(sp.ate) }, todayString());
  const canal = CHANNELS.find((c) => c === param(sp.canal));
  const status = STATUSES.find((s) => s === param(sp.status));
  const q = (param(sp.q) ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Number(param(sp.page)) || 1));

  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: startOfDayInstant(period.from), lt: endOfDayInstant(period.to) },
    ...(canal ? { channel: canal } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ customerName: { contains: q, mode: "insensitive" } }, { tableLabel: { contains: q, mode: "insensitive" } }, ...(Number(q) ? [{ number: Number(q) }] : [])] } : {}),
  };

  const [open, total, orders, paid] = await Promise.all([
    db.order.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.order.aggregate({ where: { ...where, status: "PAID" }, _sum: { totalCents: true }, _count: true }),
  ]);
  const sales = paid._sum.totalCents ?? 0;
  const now = new Date();
  const keep = { p: period.key, de: period.key === "periodo" ? period.from : undefined, ate: period.key === "periodo" ? period.to : undefined, canal, status, q: q || undefined };

  return (
    <>
      <PageHeader title="Pedidos" description="Abertos agora e histórico de vendas." actions={canEdit && <LinkButton href="/pedidos/novo" size="lg"><Plus className="size-4" /> Novo pedido</LinkButton>} />

      <section className="mb-6" aria-label="Pedidos abertos">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Abertos agora ({open.length})</h2>
        {open.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">Nenhum pedido aberto.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {open.map((o) => (
              <li key={o.id}>
                <Link href={`/pedidos/${o.id}`} className="card block p-4 transition-colors hover:border-gold-400">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-semibold leading-tight">{orderWho(o)}</p>
                    <ChannelBadge channel={o.channel} />
                  </div>
                  <p className="mt-1 text-xs text-muted">Nº {o.number} · {o._count.items} {o._count.items === 1 ? "item" : "itens"} · {timeAgo(o.createdAt, now)}</p>
                  {o.scheduledFor && <p className="mt-0.5 text-xs text-brand-700">Para {formatDateTime(o.scheduledFor)}</p>}
                  <p className="mt-2 text-xl font-semibold tabular-nums text-brand-700">{formatMoney(o.totalCents)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Histórico</h2>
      <PeriodFilter basePath="/pedidos" period={period} params={{ canal, status, q: q || undefined }} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-xl">
        <Stat label="Vendido (pagos)" value={formatMoney(sales)} tone="good" />
        <Stat label="Ticket médio" value={formatMoney(paid._count ? Math.round(sales / paid._count) : 0)} hint={`${paid._count} ${paid._count === 1 ? "pedido pago" : "pedidos pagos"}`} />
      </div>

      <FilterBar action="/pedidos">
        <input type="hidden" name="p" value={period.key} />
        {period.key === "periodo" && <><input type="hidden" name="de" value={period.from} /><input type="hidden" name="ate" value={period.to} /></>}
        <FilterField label="Tipo"><select name="canal" defaultValue={canal ?? ""} className="input"><option value="">Todos</option><option value="TABLE">Mesa / comanda</option><option value="DELIVERY">Delivery</option></select></FilterField>
        <FilterField label="Situação"><select name="status" defaultValue={status ?? ""} className="input"><option value="">Todas</option><option value="OPEN">Abertos</option><option value="PAID">Pagos</option><option value="CANCELED">Cancelados</option></select></FilterField>
        <FilterField label="Buscar" className="min-w-52 flex-1"><input type="search" name="q" defaultValue={q} placeholder="Mesa, cliente ou nº" className="input" /></FilterField>
      </FilterBar>

      {orders.length === 0 ? (
        <EmptyState title="Nenhum pedido neste filtro" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nº</th><th>Quando</th><th>Pedido</th><th>Tipo</th><th className="text-right">Total</th><th>Situação</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={o.status === "CANCELED" ? "opacity-60" : undefined}>
                  <td><Link href={`/pedidos/${o.id}`} className="font-medium text-brand-700 hover:underline">#{o.number}</Link></td>
                  <td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                  <td>{orderWho(o)}</td>
                  <td><ChannelBadge channel={o.channel} /></td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(o.totalCents)}</td>
                  <td><OrderStatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/pedidos" params={keep} />
    </>
  );
}
