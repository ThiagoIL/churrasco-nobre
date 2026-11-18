"use client";

import { useCallback, useState } from "react";
import { ActionForm, FileField, FormGrid, SelectField, StickyActions, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { LineBuilder, type CatalogItem } from "@/components/line-builder";
import { formatMoney } from "@/lib/money";
import { createPurchaseAction } from "@/app/(app)/compras/actions";

type Opt = { id: string; name: string };

export function PurchaseForm({
  items, suppliers, categories, methods, defaultCategoryId, today, suppliersEnabled = false,
}: { items: CatalogItem[]; suppliers: Opt[]; categories: Opt[]; methods: Opt[]; defaultCategoryId: string; today: string; /** recurso opcional "Fornecedores" ligado no console */ suppliersEnabled?: boolean }) {
  const [paid, setPaid] = useState(true);
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const onChange = useCallback((s: { total: number; count: number }) => setSummary(s), []);

  return (
    <ActionForm action={createPurchaseAction} className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{suppliersEnabled ? "1 · Quem vendeu e quando" : "1 · Quando"}</h2>
        <FormGrid cols={2}>
          <TextField name="date" label="Data da compra" type="date" defaultValue={today} required />
          {suppliersEnabled && <SelectField name="supplierId" label="Fornecedor (opcional)" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Não informar" />}
        </FormGrid>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">2 · O que foi comprado</h2>
        <LineBuilder items={items} mode="purchase" onChange={onChange} emptyHint="Cadastre os itens que você compra em Cadastros › Itens e valores." />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">3 · Pagamento</h2>
        <FormGrid cols={2}>
          <div className="self-end">
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm">
              <input type="checkbox" name="paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-5 accent-brand-600" />
              <span>Já foi pago</span>
            </label>
          </div>
          {!paid && <TextField name="dueDate" label="Vencimento" type="date" defaultValue={today} required hint="Fica em “a pagar” no financeiro até você dar baixa." />}
          <SelectField name="paymentMethodId" label="Forma de pagamento" options={methods.map((m) => ({ value: m.id, label: m.name }))} placeholder="Não informar" />
          <SelectField name="categoryId" label="Categoria da despesa" options={categories.map((c) => ({ value: c.id, label: c.name }))} defaultValue={defaultCategoryId} required />
          <TextField name="invoiceNumber" label="Nº da nota (opcional)" maxLength={40} />
          <TextareaField name="note" label="Observação (opcional)" rows={2} maxLength={300} span={2} />
          <FileField name="file" label="Foto ou PDF da nota (opcional)" span={2} />
        </FormGrid>
      </section>

      <StickyActions>
        <div className="mr-auto leading-tight">
          <p className="text-xs text-muted">{summary.count} {summary.count === 1 ? "item" : "itens"}</p>
          <p className="text-lg font-semibold tabular-nums text-brand-700">{formatMoney(summary.total)}</p>
        </div>
        <SubmitButton size="lg">Registrar compra</SubmitButton>
      </StickyActions>
    </ActionForm>
  );
}
