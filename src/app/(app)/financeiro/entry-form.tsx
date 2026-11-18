"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  ActionForm, CheckboxField, FormGrid, MoneyField, SelectField, StickyActions, SubmitButton, TextField, TextareaField,
} from "@/components/ui/form-kit";
import { saveEntryAction } from "@/app/(app)/financeiro/actions";

type Opt = { id: string; name: string };
export type EntryFormProps = {
  categories: (Opt & { kind: "INCOME" | "EXPENSE" })[];
  methods: Opt[];
  suppliers: Opt[];
  customers: Opt[];
  initial?: {
    id: string;
    kind: "INCOME" | "EXPENSE";
    amount: string;
    description: string;
    date: string;
    categoryId: string;
    paymentMethodId: string | null;
    supplierId: string | null;
    customerId: string | null;
    note: string | null;
    paid: boolean;
  };
  initialKind: "INCOME" | "EXPENSE";
  today: string;
  /** Recurso opcional "Clientes" ligado no console. */
  customersEnabled?: boolean;
  /** Recurso opcional "Fornecedores" ligado no console. */
  suppliersEnabled?: boolean;
};

/** Lançamento rápido: tipo, valor, descrição e categoria; o resto é opcional. */
export function EntryForm({ categories, methods, suppliers, customers, initial, initialKind, today, customersEnabled = false, suppliersEnabled = false }: EntryFormProps) {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(initial?.kind ?? initialKind);
  const [paid, setPaid] = useState(initial?.paid ?? true);
  const options = useMemo(() => categories.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.name })), [categories, kind]);
  const income = kind === "INCOME";

  return (
    <ActionForm action={saveEntryAction} resetOnSuccess className="space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div role="radiogroup" aria-label="Tipo do lançamento" className="grid grid-cols-2 gap-3">
        {(["INCOME", "EXPENSE"] as const).map((k) => {
          const Icon = k === "INCOME" ? ArrowDownToLine : ArrowUpFromLine;
          const active = kind === k;
          return (
            <label
              key={k}
              className={clsx(
                "flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-base font-semibold transition-colors",
                active
                  ? k === "INCOME" ? "border-income bg-emerald-50 text-income" : "border-expense bg-red-50 text-expense"
                  : "border-line bg-surface text-muted hover:bg-gold-50",
              )}
            >
              <input type="radio" name="kind" value={k} checked={active} onChange={() => setKind(k)} className="sr-only" />
              <Icon className="size-5" /> {k === "INCOME" ? "Receita" : "Despesa"}
            </label>
          );
        })}
      </div>

      <FormGrid cols={2}>
        <MoneyField name="amount" label="Valor" defaultValue={initial?.amount} required autoFocus={!initial} />
        <TextField name="date" label={paid ? (income ? "Data do recebimento" : "Data do pagamento") : "Vencimento"} type="date" defaultValue={initial?.date ?? today} required />
        <TextField name="description" label="Descrição" defaultValue={initial?.description} placeholder={income ? "Ex.: Evento da Maria" : "Ex.: Conta de luz"} required span={2} maxLength={120} />
        <SelectField name="categoryId" label="Categoria" options={options} defaultValue={initial?.categoryId} placeholder="Escolha…" required key={kind} />
        <SelectField name="paymentMethodId" label="Forma de pagamento" options={methods.map((m) => ({ value: m.id, label: m.name }))} defaultValue={initial?.paymentMethodId ?? ""} placeholder="Não informar" />
        {income ? (customersEnabled ? (
          <SelectField name="customerId" label="Cliente (opcional)" options={customers.map((m) => ({ value: m.id, label: m.name }))} defaultValue={initial?.customerId ?? ""} placeholder="Não informar" />
        ) : <div className="hidden sm:block" />) : !suppliersEnabled ? <div className="hidden sm:block" /> : (
          <SelectField name="supplierId" label="Fornecedor (opcional)" options={suppliers.map((m) => ({ value: m.id, label: m.name }))} defaultValue={initial?.supplierId ?? ""} placeholder="Não informar" />
        )}
        <div className="self-end">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm">
            <input type="checkbox" name="paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-5 accent-brand-600" />
            <span>{income ? "Já foi recebido" : "Já foi pago"}</span>
          </label>
        </div>
        <TextareaField name="note" label="Observação (opcional)" defaultValue={initial?.note ?? ""} span={2} rows={2} maxLength={300} />
      </FormGrid>

      <StickyActions>
        <SubmitButton size="lg" className="flex-1 sm:flex-none">Salvar</SubmitButton>
        {!initial && <SubmitButton size="lg" variant="outline" name="again" value="1" className="flex-1 sm:flex-none">Salvar e lançar outro</SubmitButton>}
      </StickyActions>
    </ActionForm>
  );
}
