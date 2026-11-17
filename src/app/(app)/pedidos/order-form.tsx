"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { Bike, CalendarClock, ShoppingBag, Utensils } from "lucide-react";
import { ActionForm, FormGrid, SelectField, StickyActions, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { LineBuilder, type CatalogItem } from "@/components/line-builder";
import { formatMoney } from "@/lib/money";
import type { FormLine } from "@/lib/lines";
import { saveOrderAction } from "@/app/(app)/pedidos/actions";

type Channel = "TABLE" | "COUNTER" | "DELIVERY" | "CATERING";
const CHANNELS = [
  { value: "TABLE", label: "Mesa", icon: Utensils },
  { value: "COUNTER", label: "Balcão", icon: ShoppingBag },
  { value: "DELIVERY", label: "Delivery", icon: Bike },
  { value: "CATERING", label: "Encomenda", icon: CalendarClock },
] as const;

export type OrderFormInitial = {
  id: string; channel: Channel; tableLabel: string; customerId: string; customerName: string; phone: string; address: string;
  scheduledFor: string; note: string; lines: FormLine[];
};

export function OrderForm({ items, customers, initial }: { items: CatalogItem[]; customers: { id: string; name: string }[]; initial?: OrderFormInitial }) {
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "TABLE");
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const onChange = useCallback((s: { total: number; count: number }) => setSummary(s), []);
  const away = channel === "DELIVERY" || channel === "CATERING";

  return (
    <ActionForm action={saveOrderAction} className="space-y-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div role="radiogroup" aria-label="Tipo do pedido" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHANNELS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={clsx(
              "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-base font-semibold transition-colors",
              channel === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:bg-gold-50",
            )}
          >
            <input type="radio" name="channel" value={value} checked={channel === value} onChange={() => setChannel(value)} className="sr-only" />
            <Icon className="size-5" /> {label}
          </label>
        ))}
      </div>

      <FormGrid cols={3}>
        {channel === "TABLE" && <TextField name="tableLabel" label="Mesa ou comanda" defaultValue={initial?.tableLabel} required maxLength={30} inputMode="text" placeholder="Ex.: 7" autoFocus={!initial} />}
        {channel === "COUNTER" && <TextField name="customerName" label="Nome (opcional)" defaultValue={initial?.customerName} maxLength={80} placeholder="Para chamar o cliente" />}
        {away && (
          <>
            <SelectField name="customerId" label="Cliente cadastrado (opcional)" defaultValue={initial?.customerId ?? ""} placeholder="Novo / não cadastrado" options={customers.map((c) => ({ value: c.id, label: c.name }))} />
            <TextField name="customerName" label="Nome do cliente" defaultValue={initial?.customerName} required maxLength={80} />
            <TextField name="phone" label="Telefone / WhatsApp" type="tel" inputMode="tel" defaultValue={initial?.phone} maxLength={30} />
            {channel === "DELIVERY" && <TextField name="address" label="Endereço de entrega" defaultValue={initial?.address} required maxLength={200} span={2} />}
            <TextField name="scheduledFor" label={channel === "CATERING" ? "Data e hora da encomenda" : "Hora combinada (opcional)"} type="datetime-local" defaultValue={initial?.scheduledFor} required={channel === "CATERING"} />
          </>
        )}
      </FormGrid>

      <LineBuilder items={items} mode="order" initial={initial?.lines} onChange={onChange} emptyHint="Cadastre os itens do cardápio em Cadastros › Itens e valores (marque “É vendido”)." />

      <TextareaField name="note" label="Observação do pedido (opcional)" defaultValue={initial?.note} rows={2} maxLength={300} placeholder="Ex.: carne ao ponto, sem pimenta" />

      <StickyActions>
        <div className="mr-auto leading-tight">
          <p className="text-xs text-muted">{summary.count} {summary.count === 1 ? "item" : "itens"}</p>
          <p className="text-lg font-semibold tabular-nums text-brand-700">{formatMoney(summary.total)}</p>
        </div>
        <SubmitButton size="lg">{initial ? "Salvar alterações" : "Abrir pedido"}</SubmitButton>
      </StickyActions>
    </ActionForm>
  );
}
