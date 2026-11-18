"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bike, Utensils } from "lucide-react";
import { ActionForm, FormGrid, SelectField, StickyActions, SubmitButton, TextField, TextareaField, useFieldError } from "@/components/ui/form-kit";
import { LineBuilder, type CatalogItem } from "@/components/line-builder";
import { formatMoney, parseMoney } from "@/lib/money";
import type { FormLine } from "@/lib/lines";
import { saveOrderAction } from "@/app/(app)/pedidos/actions";

type Channel = "TABLE" | "DELIVERY";
const CHANNELS = [
  { value: "TABLE", label: "Mesa / comanda", icon: Utensils },
  { value: "DELIVERY", label: "Delivery", icon: Bike },
] as const;

export type OrderFormInitial = {
  id: string; channel: Channel; tableLabel: string; customerId: string; customerName: string; phone: string; address: string;
  freight: string; note: string; lines: FormLine[];
};

/** Campo de valor controlado (o total do pedido muda junto com o frete). */
function FreightField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const error = useFieldError("freight");
  return (
    <div>
      <label htmlFor="order-freight" className="label">Frete (opcional)</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
        <input
          id="order-freight" name="freight" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" maxLength={16}
          value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className="input pl-10 tabular-nums"
        />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : <p className="mt-1 text-xs text-muted">Soma ao total do pedido.</p>}
    </div>
  );
}

export function OrderForm({
  items, customers, tables, initial, customersEnabled = false,
}: { items: CatalogItem[]; customers: { id: string; name: string }[]; tables: string[]; initial?: OrderFormInitial; customersEnabled?: boolean }) {
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "TABLE");
  const [freight, setFreight] = useState(initial?.freight ?? "");
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const onChange = useCallback((s: { total: number; count: number }) => setSummary(s), []);
  const delivery = channel === "DELIVERY";
  const freightCents = delivery ? parseMoney(freight) ?? 0 : 0;

  // mesa do pedido que já saiu do cadastro continua escolhível enquanto o pedido está aberto
  const tableOptions = [...new Set([...(initial?.tableLabel ? [initial.tableLabel] : []), ...tables])];

  return (
    <ActionForm action={saveOrderAction} className="space-y-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div role="radiogroup" aria-label="Tipo do pedido" className="grid grid-cols-2 gap-2">
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

      {channel === "TABLE" && (
        tableOptions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-4 text-sm text-muted">
            Nenhuma mesa ou comanda cadastrada. <Link href="/cadastros/mesas" className="font-medium text-brand-700 underline">Cadastre em Cadastros › Mesas e comandas</Link> para abrir pedidos de mesa.
          </p>
        ) : (
          <FormGrid cols={3}>
            <SelectField name="tableLabel" label="Mesa ou comanda" defaultValue={initial?.tableLabel ?? ""} placeholder="Escolha…" required options={tableOptions.map((t) => ({ value: t, label: t }))} />
          </FormGrid>
        )
      )}

      {delivery && (
        <FormGrid cols={3}>
          {customersEnabled && <SelectField name="customerId" label="Cliente cadastrado (opcional)" defaultValue={initial?.customerId ?? ""} placeholder="Novo / não cadastrado" options={customers.map((c) => ({ value: c.id, label: c.name }))} />}
          <TextField name="customerName" label="Nome do cliente" defaultValue={initial?.customerName} required maxLength={80} />
          <TextField name="phone" label="Telefone / WhatsApp" type="tel" inputMode="tel" defaultValue={initial?.phone} maxLength={30} />
          <TextField name="address" label="Endereço de entrega (opcional)" defaultValue={initial?.address} maxLength={200} span={2} />
          <FreightField value={freight} onChange={setFreight} />
        </FormGrid>
      )}

      <LineBuilder items={items} mode="order" initial={initial?.lines} onChange={onChange} emptyHint="Cadastre os itens do cardápio em Cadastros › Itens e valores (marque “É vendido”)." />

      <TextareaField name="note" label="Observação do pedido (opcional)" defaultValue={initial?.note} rows={2} maxLength={300} placeholder="Ex.: carne ao ponto, sem pimenta" />

      <StickyActions>
        <div className="mr-auto leading-tight">
          <p className="text-xs text-muted">
            {summary.count} {summary.count === 1 ? "item" : "itens"}{freightCents > 0 ? ` + frete ${formatMoney(freightCents)}` : ""}
          </p>
          <p className="text-lg font-semibold tabular-nums text-brand-700">{formatMoney(summary.total + freightCents)}</p>
        </div>
        <SubmitButton size="lg">{initial ? "Salvar alterações" : "Abrir pedido"}</SubmitButton>
      </StickyActions>
    </ActionForm>
  );
}
