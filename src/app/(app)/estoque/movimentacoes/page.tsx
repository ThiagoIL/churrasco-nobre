import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { resolvePeriod } from "@/lib/period";
import { endOfDayInstant, formatDateTime, startOfDayInstant, todayString } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { STOCK_REASON_LABELS } from "@/lib/labels";
import { Badge, EmptyState, FilterBar, FilterField, LinkTabs, PageHeader, Pagination, PeriodFilter, param } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Movimentações de estoque" };
const PAGE_SIZE = 40;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = Object.keys(STOCK_REASON_LABELS) as (keyof typeof STOCK_REASON_LABELS)[];

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireModule("ESTOQUE");
  const sp = await searchParams;
  const period = resolvePeriod({ p: param(sp.p), de: param(sp.de), ate: param(sp.ate) }, todayString());
  const itemRaw = param(sp.item);
  const item = itemRaw && uuidRe.test(itemRaw) ? itemRaw : undefined;
  const motivoRaw = param(sp.motivo);
  const motivo = REASONS.find((r) => r === motivoRaw);
  const page = Math.max(1, Math.min(10_000, Number(param(sp.page)) || 1));

  const where: Prisma.StockMovementWhereInput = {
    occurredAt: { gte: startOfDayInstant(period.from), lt: endOfDayInstant(period.to) },
    ...(item ? { itemId: item } : {}),
    ...(motivo ? { reason: motivo } : {}),
  };
  const [total, movements, items] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where, orderBy: { occurredAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { item: { select: { name: true, unit: true } }, createdBy: { select: { name: true } }, purchase: { select: { id: true, number: true } }, order: { select: { id: true, number: true } } },
    }),
    db.item.findMany({ where: { trackStock: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const keep = { p: period.key, de: period.key === "periodo" ? period.from : undefined, ate: period.key === "periodo" ? period.to : undefined, item, motivo };

  return (
    <>
      <PageHeader title="Estoque" description="Histórico de todas as entradas e saídas." />
      <LinkTabs tabs={[{ href: "/estoque", label: "Saldo dos itens", active: false }, { href: "/estoque/movimentacoes", label: "Movimentações", active: true }]} />
      <PeriodFilter basePath="/estoque/movimentacoes" period={period} params={{ item, motivo }} />
      <FilterBar action="/estoque/movimentacoes">
        <input type="hidden" name="p" value={period.key} />
        {period.key === "periodo" && <><input type="hidden" name="de" value={period.from} /><input type="hidden" name="ate" value={period.to} /></>}
        <FilterField label="Item" className="min-w-52 flex-1"><select name="item" defaultValue={item ?? ""} className="input"><option value="">Todos</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></FilterField>
        <FilterField label="Motivo"><select name="motivo" defaultValue={motivo ?? ""} className="input"><option value="">Todos</option>{REASONS.map((r) => <option key={r} value={r}>{STOCK_REASON_LABELS[r]}</option>)}</select></FilterField>
      </FilterBar>

      {movements.length === 0 ? (
        <EmptyState title="Nenhuma movimentação neste filtro" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th className="text-right">Quantidade</th><th>Motivo</th><th>Origem / observação</th><th>Usuário</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{formatDateTime(m.occurredAt)}</td>
                  <td className="font-medium">{m.item.name}</td>
                  <td><Badge tone={m.direction === "IN" ? "green" : "red"}>{m.direction === "IN" ? "Entrada" : "Saída"}</Badge></td>
                  <td className="text-right tabular-nums">{m.direction === "IN" ? "+" : "−"}{formatQty(m.qtyMilli)} {m.item.unit}</td>
                  <td>{STOCK_REASON_LABELS[m.reason]}</td>
                  <td className="text-muted">
                    {m.purchase && <Link className="text-brand-700 underline" href={`/compras/${m.purchase.id}`}>Compra nº {m.purchase.number}</Link>}
                    {m.order && <Link className="text-brand-700 underline" href={`/pedidos/${m.order.id}`}>Pedido nº {m.order.number}</Link>}
                    {m.note && <span className="ml-1">{m.note}</span>}
                    {!m.purchase && !m.order && !m.note && "—"}
                  </td>
                  <td className="text-muted">{m.createdBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/estoque/movimentacoes" params={keep} />
    </>
  );
}
