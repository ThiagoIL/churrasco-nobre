// Filtros rápidos de período (hoje, mês atual, mês anterior, intervalo livre). Regra pura, sem servidor.
import { addDays, addMonthsToStart, diffDays, endOfMonth, formatDate, isDateString, monthLabel, startOfMonth } from "@/lib/dates";

export type PeriodKey = "hoje" | "mes" | "mes-anterior" | "periodo";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "mes", label: "Mês atual" },
  { key: "mes-anterior", label: "Mês anterior" },
  { key: "periodo", label: "Período" },
];

export type Period = {
  key: PeriodKey;
  /** Primeiro dia (inclusive), "YYYY-MM-DD". */
  from: string;
  /** Último dia (inclusive), "YYYY-MM-DD". */
  to: string;
  label: string;
};

/** Intervalo livre máximo (evita consultas gigantes por engano). */
export const MAX_RANGE_DAYS = 366 * 3;

type Params = { p?: string; de?: string; ate?: string };

/** Interpreta os parâmetros da URL (`p`, `de`, `ate`). Padrão: mês atual. */
export function resolvePeriod(params: Params, today: string): Period {
  const key = (PERIODS.find((p) => p.key === params.p)?.key ?? "mes") as PeriodKey;

  if (key === "hoje") return { key, from: today, to: today, label: `Hoje, ${formatDate(today)}` };

  if (key === "mes-anterior") {
    const start = addMonthsToStart(startOfMonth(today), -1);
    return { key, from: start, to: endOfMonth(start), label: monthLabel(start) };
  }

  if (key === "periodo" && params.de && params.ate && isDateString(params.de) && isDateString(params.ate)) {
    let from = params.de;
    let to = params.ate;
    if (from > to) [from, to] = [to, from];
    if (diffDays(from, to) > MAX_RANGE_DAYS) from = addDays(to, -MAX_RANGE_DAYS);
    return { key, from, to, label: `${formatDate(from)} a ${formatDate(to)}` };
  }

  // "periodo" sem datas válidas cai no mês atual, mas mantém a aba "Período" aberta para o usuário informar as datas
  const start = startOfMonth(today);
  return {
    key: key === "periodo" ? "periodo" : "mes",
    from: start,
    to: endOfMonth(start),
    label: monthLabel(start),
  };
}

/** Período imediatamente anterior, com o mesmo tamanho (para comparar). */
export function previousPeriod(period: Period): { from: string; to: string } {
  if (period.key === "mes" || period.key === "mes-anterior") {
    const start = addMonthsToStart(period.from, -1);
    return { from: start, to: endOfMonth(start) };
  }
  const days = diffDays(period.from, period.to) + 1;
  return { from: addDays(period.from, -days), to: addDays(period.from, -1) };
}

/** Lista de dias "YYYY-MM-DD" do período (inclusive). */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Monta a query string que preserva o período em links. */
export function periodQuery(period: Period): string {
  const sp = new URLSearchParams({ p: period.key });
  if (period.key === "periodo") {
    sp.set("de", period.from);
    sp.set("ate", period.to);
  }
  return sp.toString();
}
