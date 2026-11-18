import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { selectOptions } from "@/lib/catalog";
import { centsToInput, formatMoney } from "@/lib/money";
import { dateOnlyToString, formatDate, formatDateTime, todayString } from "@/lib/dates";
import { ENTRY_SOURCE_LABELS } from "@/lib/labels";
import { Amount, Card, PageHeader } from "@/components/ui/primitives";
import { ActionForm, ButtonForm, FormGrid, SelectField, SubmitButton, TextField } from "@/components/ui/form-kit";
import { EntryStatusBadge, KindBadge } from "@/components/status-badges";
import { EntryForm } from "@/app/(app)/financeiro/entry-form";
import { cancelEntryAction, payEntryAction } from "@/app/(app)/financeiro/actions";

export const metadata: Metadata = { title: "Lançamento" };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { canEdit } = await requireModule("FINANCEIRO");
  const { id } = await params;
  if (!uuidRe.test(id)) notFound();
  const entry = await db.financialEntry.findUnique({
    where: { id },
    include: {
      category: true, paymentMethod: true, supplier: true, customer: true,
      createdBy: { select: { name: true } },
      purchase: { select: { id: true, number: true } },
      order: { select: { id: true, number: true } },
    },
  });
  if (!entry) notFound();

  const today = todayString();
  const date = dateOnlyToString(entry.date);
  const editable = canEdit && entry.source === "MANUAL" && entry.status !== "CANCELED";
  const { categories, methods, suppliers, customers, customersEnabled, suppliersEnabled } = await selectOptions();

  return (
    <>
      <PageHeader
        title={entry.description}
        back={{ href: "/financeiro", label: "Financeiro" }}
        actions={<><KindBadge kind={entry.kind} /><EntryStatusBadge kind={entry.kind} status={entry.status} overdue={date < today} /></>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div>
          {editable ? (
            <Card title="Editar lançamento">
              <EntryForm
                categories={categories} methods={methods} suppliers={suppliers} customers={customers} customersEnabled={customersEnabled} suppliersEnabled={suppliersEnabled}
                initialKind={entry.kind} today={today}
                initial={{
                  id: entry.id, kind: entry.kind, amount: centsToInput(entry.amountCents), description: entry.description,
                  date, categoryId: entry.categoryId, paymentMethodId: entry.paymentMethodId, supplierId: entry.supplierId,
                  customerId: entry.customerId, note: entry.note, paid: entry.status === "PAID",
                }}
              />
            </Card>
          ) : (
            <Card title="Dados do lançamento">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted">Valor</dt><dd className="text-xl font-semibold"><Amount value={formatMoney(entry.amountCents)} kind={entry.kind} /></dd></div>
                <div><dt className="text-xs text-muted">Data</dt><dd>{formatDate(date)}</dd></div>
                <div><dt className="text-xs text-muted">Categoria</dt><dd>{entry.category.name}</dd></div>
                <div><dt className="text-xs text-muted">Forma de pagamento</dt><dd>{entry.paymentMethod?.name ?? "—"}</dd></div>
                {suppliersEnabled && entry.supplier && <div><dt className="text-xs text-muted">Fornecedor</dt><dd>{entry.supplier.name}</dd></div>}
                {entry.customer && <div><dt className="text-xs text-muted">Cliente</dt><dd>{entry.customer.name}</dd></div>}
                {entry.note && <div className="sm:col-span-2"><dt className="text-xs text-muted">Observação</dt><dd className="whitespace-pre-wrap">{entry.note}</dd></div>}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Origem">
            <p className="text-sm">
              {ENTRY_SOURCE_LABELS[entry.source]}
              {entry.purchase && <> · <Link className="text-brand-700 underline" href={`/compras/${entry.purchase.id}`}>Compra nº {entry.purchase.number}</Link></>}
              {entry.order && <> · <Link className="text-brand-700 underline" href={`/pedidos/${entry.order.id}`}>Pedido nº {entry.order.number}</Link></>}
            </p>
            <p className="mt-2 text-xs text-muted">
              Criado {formatDateTime(entry.createdAt)}{entry.createdBy ? ` por ${entry.createdBy.name}` : ""}.
              {entry.canceledAt && <> Cancelado em {formatDateTime(entry.canceledAt)}.</>}
            </p>
            {entry.source !== "MANUAL" && entry.status !== "CANCELED" && (
              <p className="mt-2 text-xs text-muted">Para desfazer, cancele a {entry.purchase ? "compra" : "venda (pedido)"}: o lançamento e o estoque são estornados juntos.</p>
            )}
          </Card>

          {canEdit && entry.status === "PENDING" && (
            <Card title={entry.kind === "INCOME" ? "Registrar recebimento" : "Registrar pagamento"}>
              <ActionForm action={payEntryAction} className="space-y-4">
                <input type="hidden" name="id" value={entry.id} />
                <FormGrid cols={2}>
                  <TextField name="date" label={entry.kind === "INCOME" ? "Data do recebimento" : "Data do pagamento"} type="date" defaultValue={today} required />
                  <SelectField name="paymentMethodId" label="Forma de pagamento" options={methods.map((m) => ({ value: m.id, label: m.name }))} defaultValue={entry.paymentMethodId ?? ""} placeholder="Manter" />
                </FormGrid>
                <SubmitButton>{entry.kind === "INCOME" ? "Marcar como recebido" : "Marcar como pago"}</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {editable && (
            <Card title="Cancelar lançamento" description="Fica no histórico, mas deixa de contar nos totais.">
              <ButtonForm action={cancelEntryAction} fields={{ id: entry.id }} variant="danger" size={undefined} confirm="Cancelar este lançamento? Esta ação não pode ser desfeita.">Cancelar lançamento</ButtonForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
