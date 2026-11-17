"use client";

import { useId } from "react";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, MoneyField, QtyField, SubmitButton, TextField, TextareaField, useFieldError,
} from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { UNITS } from "@/lib/labels";
import { saveItemAction } from "@/app/(app)/cadastros/actions";

type Initial = {
  id: string; name: string; code: string; unit: string; groupName: string; purchasable: boolean; sellable: boolean;
  trackStock: boolean; cost: string; price: string; minStock: string; active: boolean; note: string;
};

function DatalistField({ name, label, options, defaultValue, hint, required, maxLength }: { name: string; label: string; options: readonly string[]; defaultValue?: string; hint?: string; required?: boolean; maxLength: number }) {
  const listId = useId();
  const error = useFieldError(name);
  return (
    <div>
      <label htmlFor={`${listId}-input`} className="label">{label}{required && <span className="text-brand-600"> *</span>}</label>
      <input id={`${listId}-input`} name={name} list={listId} defaultValue={defaultValue} required={required} maxLength={maxLength} autoComplete="off" className="input" aria-invalid={error ? true : undefined} />
      <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ItemForm({ initial, groups }: { initial?: Initial; groups: string[] }) {
  return (
    <ActionForm action={saveItemAction} className="space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={3}>
        <TextField name="name" label="Nome do item" defaultValue={initial?.name} required span={2} maxLength={120} placeholder="Ex.: Picanha, Cerveja long neck, Carvão" autoFocus={!initial} />
        <TextField name="code" label="Código (opcional)" defaultValue={initial?.code} maxLength={30} />
        <DatalistField name="unit" label="Unidade" options={UNITS} defaultValue={initial?.unit ?? "un"} required maxLength={12} hint="kg, un, L, cx…" />
        <DatalistField name="groupName" label="Grupo (opcional)" options={groups} defaultValue={initial?.groupName} maxLength={40} hint="Carnes, Bebidas, Acompanhamentos…" />
        <div />
        <MoneyField name="cost" label="Custo por unidade" defaultValue={initial?.cost} hint="Atualizado a cada compra." />
        <MoneyField name="price" label="Preço de venda por unidade" defaultValue={initial?.price} hint="Usado nos pedidos." />
        <QtyField name="minStock" label="Estoque mínimo" defaultValue={initial?.minStock} hint="Abaixo disso o item aparece como “baixo”." />
        {!initial && <QtyField name="initialStock" label="Saldo inicial (opcional)" hint="Quanto você já tem em estoque agora." />}
      </FormGrid>

      <div className="grid gap-1 sm:grid-cols-3">
        <CheckboxField name="purchasable" label="É comprado (insumo)" defaultChecked={initial?.purchasable ?? true} hint="Aparece nas compras." />
        <CheckboxField name="sellable" label="É vendido (cardápio)" defaultChecked={initial?.sellable ?? false} hint="Aparece nos pedidos." />
        <CheckboxField name="trackStock" label="Controla estoque" defaultChecked={initial?.trackStock ?? true} hint="Compras entram e vendas/consumo saem." />
      </div>
      {initial && <CheckboxField name="active" label="Ativo" defaultChecked={initial.active} hint="Inativo some das listas de escolha." />}
      <TextareaField name="note" label="Observação (opcional)" defaultValue={initial?.note} rows={2} maxLength={300} />

      <FormActions>
        <SubmitButton size="lg">Salvar item</SubmitButton>
        <LinkButton href="/cadastros/itens" variant="ghost" size="lg">Voltar</LinkButton>
      </FormActions>
    </ActionForm>
  );
}
