"use client";

import { ActionForm, FormGrid, QtyField, SelectField, StickyActions, SubmitButton, TextField } from "@/components/ui/form-kit";
import { LineBuilder, type CatalogItem } from "@/components/line-builder";
import { stockAdjustAction, stockInitialAction, stockOutAction } from "@/app/(app)/estoque/actions";

export function StockOutForm({ items }: { items: CatalogItem[] }) {
  return (
    <ActionForm action={stockOutAction} className="space-y-5" resetOnSuccess>
      <FormGrid cols={2}>
        <SelectField name="reason" label="Motivo" defaultValue="CONSUMPTION" options={[{ value: "CONSUMPTION", label: "Consumo (usado na cozinha / evento)" }, { value: "LOSS", label: "Perda / desperdício / vencimento" }]} required />
        <TextField name="note" label="Observação (opcional)" maxLength={200} placeholder="Ex.: Evento sábado, carne estragada" />
      </FormGrid>
      <LineBuilder items={items} mode="stock" key="stock-out" emptyHint="Nenhum item controla estoque. Ative “Controla estoque” em Cadastros › Itens." />
      <StickyActions><SubmitButton size="lg">Lançar saída</SubmitButton></StickyActions>
    </ActionForm>
  );
}

export function StockAdjustForm({ items }: { items: CatalogItem[] }) {
  return (
    <ActionForm action={stockAdjustAction} className="space-y-4" resetOnSuccess>
      <FormGrid cols={2}>
        <SelectField name="itemId" label="Item contado" placeholder="Escolha…" required options={items.map((i) => ({ value: i.id, label: `${i.name} — saldo ${(i.stockMilli / 1000).toString().replace(".", ",")} ${i.unit}` }))} />
        <QtyField name="counted" label="Quantidade contada" required hint="O sistema lança a diferença em relação ao saldo atual." />
        <TextField name="note" label="Observação (opcional)" maxLength={200} span={2} placeholder="Ex.: Inventário de fim de mês" />
      </FormGrid>
      <SubmitButton variant="outline">Ajustar saldo</SubmitButton>
    </ActionForm>
  );
}

export function StockInitialForm({ items }: { items: CatalogItem[] }) {
  return (
    <ActionForm action={stockInitialAction} className="space-y-5" resetOnSuccess>
      <LineBuilder items={items} mode="stock" key="stock-initial" title="Itens com saldo inicial" emptyHint="Nenhum item controla estoque. Ative “Controla estoque” em Cadastros › Itens." />
      <StickyActions><SubmitButton size="lg">Lançar saldo inicial</SubmitButton></StickyActions>
    </ActionForm>
  );
}
