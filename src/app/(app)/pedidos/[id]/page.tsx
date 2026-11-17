import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getAccess, requireModule } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatQty } from "@/lib/money";
import { orderTitle } from "@/lib/order-utils";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { ActionForm, FormGrid, MoneyField, SelectField, SubmitButton } from "@/components/ui/form-kit";
import { ChannelBadge, OrderStatusBadge } from "@/components/status-badges";
import { cancelOrderAction, payOrderAction } from "@/app/(app)/pedidos/actions";

export const metadata: Metadata = { title: "Pedido" };
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { canEdit } = await requireModule("PEDIDOS");
  const { id } = await params;
  if (!uuidRe.test(id)) notFound();
  const order = await db.order.findUnique({
    where: { id },
    include: { items: { orderBy: { name: "asc" } }, paymentMethod: true, createdBy: { select: { name: true } }, entry: { select: { id: true } } },
  });
  if (!order) notFound();
  const methods = order.status === "OPEN" ? await db.paymentMethod.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [];
  const canSeeFinance = hasAccess(await getAccess(), "FINANCEIRO");
  const subtotal = order.items.reduce((s, l) => s + l.totalCents, 0);

  return (
    <>
      <PageHeader
        title={orderTitle(order)}
        back={{ href: "/pedidos", label: "Pedidos" }}
        actions={
          <>
            <ChannelBadge channel={order.channel} />
            <OrderStatusBadge status={order.status} />
            {canEdit && order.status === "OPEN" && <LinkButton href={`/pedidos/${order.id}/editar`} variant="outline"><Pencil className="size-4" /> Editar itens</LinkButton>}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card title="Itens" padded={false}>
            <div className="table-wrap rounded-none border-0">
              <table className="table">
                <thead><tr><th>Item</th><th className="text-right">Quantidade</th><th className="text-right">Preço</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {order.items.map((l) => (
                    <tr key={l.id}>
                      <td className="font-medium">{l.name}{l.note && <span className="block text-xs font-normal text-muted">{l.note}</span>}</td>
                      <td className="text-right tabular-nums">{formatQty(l.qtyMilli)} {l.unit}</td>
                      <td className="text-right tabular-nums">{formatMoney(l.unitPriceCents)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(l.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {order.discountCents > 0 && (
                    <>
                      <tr><td colSpan={3} className="px-4 py-2 text-right text-sm text-muted">Subtotal</td><td className="px-4 py-2 text-right tabular-nums">{formatMoney(subtotal)}</td></tr>
                      <tr><td colSpan={3} className="px-4 py-2 text-right text-sm text-muted">Desconto</td><td className="px-4 py-2 text-right tabular-nums text-expense">− {formatMoney(order.discountCents)}</td></tr>
                    </>
                  )}
                  <tr><td colSpan={3} className="px-4 py-3 text-right text-sm font-medium">Total</td><td className="px-4 py-3 text-right text-lg font-semibold tabular-nums text-brand-700">{formatMoney(order.totalCents)}</td></tr>
                </tfoot>
              </table>
            </div>
          </Card>
          {order.note && <Card title="Observação"><p className="whitespace-pre-wrap text-sm">{order.note}</p></Card>}
        </div>

        <div className="space-y-5">
          <Card title="Dados do pedido">
            <dl className="space-y-3 text-sm">
              {order.tableLabel && <div><dt className="text-xs text-muted">Mesa / comanda</dt><dd>{order.tableLabel}</dd></div>}
              {order.customerName && <div><dt className="text-xs text-muted">Cliente</dt><dd>{order.customerName}</dd></div>}
              {order.phone && <div><dt className="text-xs text-muted">Telefone</dt><dd><a className="text-brand-700 underline" href={`tel:${order.phone.replace(/[^\d+]/g, "")}`}>{order.phone}</a></dd></div>}
              {order.address && <div><dt className="text-xs text-muted">Endereço</dt><dd>{order.address}</dd></div>}
              {order.scheduledFor && <div><dt className="text-xs text-muted">Combinado para</dt><dd>{formatDateTime(order.scheduledFor)}</dd></div>}
              <div><dt className="text-xs text-muted">Aberto</dt><dd>{formatDateTime(order.createdAt)}{order.createdBy ? ` por ${order.createdBy.name}` : ""}</dd></div>
              {order.paidAt && <div><dt className="text-xs text-muted">Pago em</dt><dd>{formatDateTime(order.paidAt)}{order.paymentMethod ? ` · ${order.paymentMethod.name}` : ""}</dd></div>}
              {order.canceledAt && <div><dt className="text-xs text-muted">Cancelado em</dt><dd>{formatDateTime(order.canceledAt)}</dd></div>}
              {canSeeFinance && order.entry && <div><dt className="text-xs text-muted">Receita gerada</dt><dd><Link className="text-brand-700 underline" href={`/financeiro/${order.entry.id}`}>Ver lançamento</Link></dd></div>}
            </dl>
          </Card>

          {canEdit && order.status === "OPEN" && (
            <Card title="Fechar e receber" description="Gera a receita no financeiro e baixa o estoque dos itens vendidos.">
              <ActionForm action={payOrderAction} className="space-y-4">
                <input type="hidden" name="id" value={order.id} />
                <FormGrid cols={2}>
                  <SelectField name="paymentMethodId" label="Forma de pagamento" required placeholder="Escolha…" options={methods.map((m) => ({ value: m.id, label: m.name }))} span={2} />
                  <MoneyField name="discount" label="Desconto (opcional)" span={2} />
                </FormGrid>
                <SubmitButton size="lg" className="w-full">Receber {formatMoney(subtotal)}</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {canEdit && order.status !== "CANCELED" && (
            <Card title="Cancelar pedido" description={order.status === "PAID" ? "A receita é cancelada e o estoque volta." : "O pedido sai da lista de abertos."}>
              <ActionForm action={cancelOrderAction}>
                <input type="hidden" name="id" value={order.id} />
                <SubmitButton variant="danger" confirm="Cancelar este pedido?">Cancelar pedido</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
