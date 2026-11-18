import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { dateOnlyToString, formatDate, formatDateTime, todayString } from "@/lib/dates";
import { formatMoney, formatQty } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ActionForm, SubmitButton, TextField, FormGrid } from "@/components/ui/form-kit";
import { PurchaseStatusBadge } from "@/components/status-badges";
import { AttachmentsCard } from "@/app/(app)/compras/attachments-card";
import { cancelPurchaseAction } from "@/app/(app)/compras/actions";
import { payEntryAction } from "@/app/(app)/financeiro/actions";
import { hasAccess } from "@/lib/access";
import { getAccess } from "@/lib/auth";
import { featureOn } from "@/lib/features";

export const metadata: Metadata = { title: "Compra" };
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { canEdit } = await requireModule("COMPRAS");
  const { id } = await params;
  const suppliersOn = await featureOn("FORNECEDORES");
  if (!uuidRe.test(id)) notFound();
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      supplier: true, paymentMethod: true, category: true, createdBy: { select: { name: true } },
      items: { include: { item: { select: { id: true, name: true, unit: true, trackStock: true } } }, orderBy: { item: { name: "asc" } } },
      entry: { select: { id: true, status: true } },
      // só os metadados: o conteúdo do arquivo só sai pela rota de download
      attachments: { select: { id: true, fileName: true, contentType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!purchase) notFound();

  const access = await getAccess();
  const canSeeFinance = hasAccess(access, "FINANCEIRO");
  const canPay = hasAccess(access, "FINANCEIRO", "EDIT");
  const today = todayString();

  return (
    <>
      <PageHeader
        title={`Compra nº ${purchase.number}`}
        back={{ href: "/compras", label: "Compras" }}
        actions={<PurchaseStatusBadge status={purchase.status} paid={purchase.paid} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card title="Itens comprados" padded={false}>
            <div className="table-wrap rounded-none border-0">
              <table className="table">
                <thead><tr><th>Item</th><th className="text-right">Quantidade</th><th className="text-right">Custo unitário</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {purchase.items.map((l) => (
                    <tr key={l.id}>
                      <td className="font-medium">{l.item.name}</td>
                      <td className="text-right tabular-nums">{formatQty(l.qtyMilli)} {l.item.unit}</td>
                      <td className="text-right tabular-nums">{formatMoney(l.unitCostCents)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(l.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} className="px-4 py-3 text-right text-sm font-medium">Total</td><td className="px-4 py-3 text-right text-lg font-semibold tabular-nums text-brand-700">{formatMoney(purchase.totalCents)}</td></tr></tfoot>
              </table>
            </div>
          </Card>
          <Card title="Comprovantes" description="Foto ou PDF da nota fiscal.">
            <AttachmentsCard
              purchaseId={purchase.id}
              canEdit={canEdit}
              attachments={purchase.attachments.map((a) => ({ id: a.id, fileName: a.fileName, contentType: a.contentType, sizeBytes: a.sizeBytes, createdAt: formatDateTime(a.createdAt) }))}
            />
          </Card>
          {purchase.status === "CANCELED" && (
            <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
              Cancelada em {formatDateTime(purchase.canceledAt)}{purchase.cancelReason ? ` — motivo: ${purchase.cancelReason}` : ""}. O estoque e a despesa foram estornados.
            </p>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Dados da compra">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-muted">Data</dt><dd>{formatDate(dateOnlyToString(purchase.date))}</dd></div>
              {suppliersOn && <div><dt className="text-xs text-muted">Fornecedor</dt><dd>{purchase.supplier?.name ?? "—"}</dd></div>}
              <div><dt className="text-xs text-muted">Forma de pagamento</dt><dd>{purchase.paymentMethod?.name ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted">Categoria da despesa</dt><dd>{purchase.category.name}</dd></div>
              {purchase.invoiceNumber && <div><dt className="text-xs text-muted">Nota fiscal</dt><dd>{purchase.invoiceNumber}</dd></div>}
              {!purchase.paid && purchase.dueDate && <div><dt className="text-xs text-muted">Vencimento</dt><dd>{formatDate(dateOnlyToString(purchase.dueDate))}</dd></div>}
              {purchase.note && <div><dt className="text-xs text-muted">Observação</dt><dd className="whitespace-pre-wrap">{purchase.note}</dd></div>}
              <div><dt className="text-xs text-muted">Lançada</dt><dd>{formatDateTime(purchase.createdAt)}{purchase.createdBy ? ` por ${purchase.createdBy.name}` : ""}</dd></div>
              {canSeeFinance && purchase.entry && <div><dt className="text-xs text-muted">Despesa gerada</dt><dd><Link className="text-brand-700 underline" href={`/financeiro/${purchase.entry.id}`}>Ver lançamento</Link></dd></div>}
            </dl>
          </Card>

          {purchase.status === "RECEIVED" && !purchase.paid && canPay && purchase.entry && (
            <Card title="Registrar pagamento">
              <ActionForm action={payEntryAction} className="space-y-4">
                <input type="hidden" name="id" value={purchase.entry.id} />
                <FormGrid cols={2}><TextField name="date" label="Data do pagamento" type="date" defaultValue={today} required /></FormGrid>
                <SubmitButton>Marcar como paga</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {canEdit && purchase.status === "RECEIVED" && (
            <Card title="Cancelar compra" description="Estorna a entrada no estoque e cancela a despesa. Use se lançou algo errado.">
              <ActionForm action={cancelPurchaseAction} className="space-y-3">
                <input type="hidden" name="id" value={purchase.id} />
                <TextField name="reason" label="Motivo (opcional)" maxLength={200} />
                <SubmitButton variant="danger" confirm="Cancelar esta compra? O estoque e a despesa serão estornados.">Cancelar compra</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
