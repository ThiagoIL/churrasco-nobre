"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Minus, Plus, Search, X } from "lucide-react";
import { centsToInput, formatMoney, formatQty, lineTotal, parseMoney, parseQty } from "@/lib/money";
import type { FormLine } from "@/lib/lines";

export type CatalogItem = {
  id: string;
  name: string;
  unit: string;
  groupName: string | null;
  code: string | null;
  priceCents: number;
  costCents: number;
  stockMilli: number;
  trackStock: boolean;
};

type Mode = "order" | "purchase" | "stock";

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Passo do botão +/−: itens medidos em peso ou volume andam de 0,5 em 0,5. */
const stepFor = (unit: string) => (["kg", "L"].includes(unit) ? 500 : 1000);
const milliToText = (m: number) => (m / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");

/**
 * Seletor de itens com quantidades, feito para o celular: busca, toque para adicionar, botões + e −,
 * campo numérico por linha e total ao vivo. Envia as linhas no campo oculto `name` (JSON);
 * o servidor revalida tudo e lê os preços no banco (nada do que vem daqui é confiado).
 */
export function LineBuilder({
  items, mode, initial = [], name = "lines", emptyHint,
  onChange,
}: { items: CatalogItem[]; mode: Mode; initial?: FormLine[]; name?: string; emptyHint?: string; onChange?: (summary: { total: number; count: number }) => void }) {
  const [lines, setLines] = useState<FormLine[]>(initial);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("");

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const groups = useMemo(() => [...new Set(items.map((i) => i.groupName).filter((g): g is string => !!g))].sort(), [items]);

  const q = normalize(query.trim());
  const visible = useMemo(() => {
    const list = items.filter(
      (i) => (!group || i.groupName === group) && (!q || normalize(`${i.name} ${i.code ?? ""} ${i.groupName ?? ""}`).includes(q)),
    );
    return mode === "order" ? list : list.slice(0, q ? 40 : 24);
  }, [items, group, q, mode]);

  const unitCents = (line: FormLine, item: CatalogItem) => (mode === "order" ? item.priceCents : (parseMoney(line.unitCost ?? "") ?? 0));
  const total = lines.reduce((sum, l) => {
    const item = byId.get(l.itemId);
    const qty = parseQty(l.qty);
    return item && qty ? sum + lineTotal(unitCents(l, item), qty) : sum;
  }, 0);

  useEffect(() => {
    onChange?.({ total, count: lines.length });
  }, [total, lines.length, onChange]);

  function add(item: CatalogItem) {
    setLines((cur) => {
      const idx = cur.findIndex((l) => l.itemId === item.id);
      if (idx >= 0) {
        const qty = (parseQty(cur[idx].qty) ?? 0) + stepFor(item.unit);
        return cur.map((l, i) => (i === idx ? { ...l, qty: milliToText(qty) } : l));
      }
      return [...cur, { itemId: item.id, qty: milliToText(stepFor(item.unit)), unitCost: mode === "purchase" ? centsToInput(item.costCents) : undefined }];
    });
  }
  const patch = (itemId: string, change: Partial<FormLine>) => setLines((cur) => cur.map((l) => (l.itemId === itemId ? { ...l, ...change } : l)));
  const remove = (itemId: string) => setLines((cur) => cur.filter((l) => l.itemId !== itemId));
  function step(line: FormLine, item: CatalogItem, dir: 1 | -1) {
    const next = (parseQty(line.qty) ?? 0) + dir * stepFor(item.unit);
    if (next <= 0) remove(line.itemId);
    else patch(line.itemId, { qty: milliToText(next) });
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(lines)} />

      {/* busca e grupos */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar item…" aria-label="Buscar item"
            autoComplete="off" enterKeyHint="search" className="input pl-9"
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          />
        </div>
        {groups.length > 1 && (
          <div className="scroll-x -mx-4 flex gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Grupos">
            <button type="button" className="chip shrink-0" aria-current={group === "" ? "true" : undefined} onClick={() => setGroup("")}>Todos</button>
            {groups.map((g) => (
              <button key={g} type="button" className="chip shrink-0" aria-current={group === g ? "true" : undefined} onClick={() => setGroup(g)}>{g}</button>
            ))}
          </div>
        )}
      </div>

      {/* itens para tocar */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{emptyHint ?? "Nenhum item cadastrado."}</p>
      ) : visible.length === 0 ? (
        <p className="px-1 text-sm text-muted">Nenhum item encontrado.</p>
      ) : (
        <ul className={clsx("grid gap-2", mode === "order" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
          {visible.map((item) => {
            const inCart = lines.some((l) => l.itemId === item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => add(item)}
                  className={clsx(
                    "flex min-h-14 w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.98]",
                    inCart ? "border-brand-500 bg-brand-50" : "border-line bg-surface hover:border-gold-400 hover:bg-gold-50",
                  )}
                >
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{item.name}</span>
                  <span className="mt-0.5 text-xs text-muted">
                    {mode === "order" && <>{formatMoney(item.priceCents)} / {item.unit}</>}
                    {mode === "purchase" && <>último custo {formatMoney(item.costCents)} / {item.unit}</>}
                    {mode === "stock" && <>saldo {formatQty(item.stockMilli)} {item.unit}</>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* itens escolhidos */}
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h3 className="text-sm font-semibold">{mode === "stock" ? "Itens da saída" : mode === "purchase" ? "Itens comprados" : "Itens do pedido"}</h3>
          <span className="text-xs text-muted">{lines.length} {lines.length === 1 ? "item" : "itens"}</span>
        </div>
        {lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Toque em um item acima para adicionar.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((line) => {
              const item = byId.get(line.itemId);
              if (!item) return null;
              const qty = parseQty(line.qty);
              const lineSum = qty ? lineTotal(unitCents(line, item), qty) : 0;
              return (
                <li key={line.itemId} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.name}</p>
                      <p className="text-xs text-muted">
                        {mode === "order" && <>{formatMoney(item.priceCents)} / {item.unit}</>}
                        {mode === "stock" && <>saldo {formatQty(item.stockMilli)} {item.unit}</>}
                        {mode === "purchase" && <>em {item.unit}</>}
                      </p>
                    </div>
                    <button type="button" onClick={() => remove(line.itemId)} aria-label={`Remover ${item.name}`} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600">
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-lg border border-line">
                      <button type="button" onClick={() => step(line, item, -1)} aria-label="Diminuir" className="grid size-11 place-items-center text-brand-700 hover:bg-brand-50"><Minus className="size-4" /></button>
                      <input
                        value={line.qty} onChange={(e) => patch(line.itemId, { qty: e.target.value })} inputMode="decimal" aria-label={`Quantidade de ${item.name}`}
                        className={clsx("h-11 w-16 border-x border-line bg-transparent text-center text-base tabular-nums outline-none focus:bg-gold-50", qty === null && "text-red-600")}
                      />
                      <button type="button" onClick={() => step(line, item, 1)} aria-label="Aumentar" className="grid size-11 place-items-center text-brand-700 hover:bg-brand-50"><Plus className="size-4" /></button>
                    </div>
                    <span className="text-sm text-muted">{item.unit}</span>
                    {mode === "purchase" && (
                      <label className="flex items-center gap-1.5 text-sm">
                        <span className="text-xs text-muted">custo/{item.unit}</span>
                        <span className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">R$</span>
                          <input
                            value={line.unitCost ?? ""} onChange={(e) => patch(line.itemId, { unitCost: e.target.value })} inputMode="decimal" aria-label={`Custo de ${item.name}`}
                            className="input w-28 pl-8 tabular-nums"
                          />
                        </span>
                      </label>
                    )}
                    {mode !== "stock" && <span className="ml-auto text-sm font-semibold tabular-nums">{formatMoney(lineSum)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {mode !== "stock" && lines.length > 0 && (
          <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-3 text-sm">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold tabular-nums text-brand-700">{formatMoney(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
