// Leitura (validada) dos filtros da tela de lançamentos, compartilhada pela lista e pela exportação CSV.
import { z } from "zod";
import { resolvePeriod, type Period } from "@/lib/period";
import { todayString } from "@/lib/dates";
import type { EntryFilters } from "@/lib/finance-queries";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParsedEntryParams = {
  period: Period;
  today: string;
  tipo?: "receita" | "despesa";
  status?: "pagos" | "pendentes" | "cancelados";
  cat?: string;
  q: string;
  page: number;
  filters: EntryFilters;
};

export function parseEntryParams(sp: SP): ParsedEntryParams {
  const today = todayString();
  const period = resolvePeriod({ p: first(sp.p), de: first(sp.de), ate: first(sp.ate) }, today);
  const tipo = z.enum(["receita", "despesa"]).safeParse(first(sp.tipo)).data;
  const status = z.enum(["pagos", "pendentes", "cancelados"]).safeParse(first(sp.status)).data;
  const catRaw = first(sp.cat);
  const cat = catRaw && uuidRe.test(catRaw) ? catRaw : undefined;
  const q = (first(sp.q) ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Number(first(sp.page)) || 1));
  return {
    period, today, tipo, status, cat, q, page,
    filters: {
      from: period.from,
      to: period.to,
      kind: tipo === "receita" ? "INCOME" : tipo === "despesa" ? "EXPENSE" : undefined,
      status: status === "pagos" ? "PAID" : status === "pendentes" ? "PENDING" : status === "cancelados" ? "CANCELED" : undefined,
      categoryId: cat,
      q: q || undefined,
    },
  };
}
