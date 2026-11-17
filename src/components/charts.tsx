import clsx from "clsx";
import { formatMoney } from "@/lib/money";

export type BarPoint = { label: string; income: number; expense: number };

/** Gráfico de barras duplas (receitas × despesas) em SVG: sem bibliotecas, leve e legível no celular. */
export function IncomeExpenseChart({ points }: { points: BarPoint[] }) {
  const W = 640;
  const H = 230;
  const pad = { top: 12, right: 8, bottom: 28, left: 8 };
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.min(18, Math.max(2, slot * 0.38));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const step = Math.ceil(points.length / 8);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receitas e despesas no período" className="h-auto w-full">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad.left} x2={W - pad.right} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-line)" strokeWidth="1" />
        ))}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="var(--color-muted)" strokeWidth="1" opacity="0.5" />
        {points.map((p, i) => {
          const cx = pad.left + slot * i + slot / 2;
          return (
            <g key={p.label + i}>
              <title>{`${p.label}\nReceitas: ${formatMoney(p.income)}\nDespesas: ${formatMoney(p.expense)}`}</title>
              <rect x={cx - barW - 1} y={y(p.income)} width={barW} height={Math.max(0, y(0) - y(p.income))} rx="2" fill="var(--color-income)" />
              <rect x={cx + 1} y={y(p.expense)} width={barW} height={Math.max(0, y(0) - y(p.expense))} rx="2" fill="var(--color-brand-500)" />
              {i % step === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{p.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-income" /> Receitas</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-brand-500" /> Despesas</span>
        <span className="ml-auto">Escala máxima: {formatMoney(max)}</span>
      </figcaption>
    </figure>
  );
}

export type BarRow = { label: string; value: number; hint?: string };

/** Lista de barras horizontais (ranking): categorias, itens mais vendidos, formas de pagamento. */
export function HBars({ rows, format = formatMoney, tone = "brand", empty = "Sem dados no período." }: {
  rows: BarRow[]; format?: (v: number) => string; tone?: "brand" | "income" | "gold"; empty?: string;
}) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {format(r.value)} <span className="text-xs text-muted">{r.hint ?? `${Math.round((r.value / total) * 100)}%`}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-canvas" role="presentation">
            <div
              className={clsx("h-full rounded-full", tone === "brand" && "bg-brand-500", tone === "income" && "bg-income", tone === "gold" && "bg-gold-500")}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
