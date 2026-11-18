"use client";

import { useId } from "react";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, MoneyField, SubmitButton, TextField, TextareaField, useFieldError,
} from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { saveItemAction } from "@/app/(app)/cadastros/actions";

type Initial = {
  id: string; name: string; groupName: string; purchasable: boolean; sellable: boolean;
  trackStock: boolean; cost: string; price: string; active: boolean; note: string;
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
        <TextField name="name" label="Nome do item" defaultValue={initial?.name} required maxLength={120} placeholder="Ex.: Picanha, Cerveja long neck, Carvão" autoFocus={!initial} />
        <DatalistField name="groupName" label="Grupo" options={groups} defaultValue={initial?.groupName} required maxLength={40} hint="Carnes, Bebidas, Acompanhamentos…" />
        <MoneyField name="cost" label="Custo" defaultValue={initial?.cost} hint="Atualizado a cada compra." />
        <MoneyField name="price" label="Preço de venda" defaultValue={initial?.price} hint="Usado nos pedidos." />
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
