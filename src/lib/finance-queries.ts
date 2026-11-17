import "server-only";
import { db } from "@/lib/db";
import { dateOnly, dateOnlyToString, addDays } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";

export type Totals = {
  /** Receitas já recebidas. */
  income: number;
  /** Despesas já pagas. */
  expense: number;
  /** income − expense. */
  balance: number;
  /** A receber (pendente) no período. */
  receivable: number;
  /** A pagar (pendente) no período. */
  payable: number;
  /** Pendentes vencidos (data anterior a hoje). */
  overdueReceivable: number;
  overduePayable: number;
};

const range = (from: string, to: string) => ({ gte: dateOnly(from), lte: dateOnly(to) });

/** Totais do período (por data do lançamento). Cancelados ficam de fora. */
export async function periodTotals(from: string, to: string, today: string): Promise<Totals> {
  const groups = await db.financialEntry.groupBy({
    by: ["kind", "status"],
    where: { date: range(from, to), status: { in: ["PAID", "PENDING"] } },
    _sum: { amountCents: true },
  });
  const overdue = await db.financialEntry.groupBy({
    by: ["kind"],
    where: { status: "PENDING", date: { lt: dateOnly(today) } },
    _sum: { amountCents: true },
  });
  const sum = (kind: "INCOME" | "EXPENSE", status: "PAID" | "PENDING") =>
    groups.find((g) => g.kind === kind && g.status === status)?._sum.amountCents ?? 0;
  const over = (kind: "INCOME" | "EXPENSE") => overdue.find((g) => g.kind === kind)?._sum.amountCents ?? 0;
  const income = sum("INCOME", "PAID");
  const expense = sum("EXPENSE", "PAID");
  return {
    income,
    expense,
    balance: income - expense,
    receivable: sum("INCOME", "PENDING"),
    payable: sum("EXPENSE", "PENDING"),
    overdueReceivable: over("INCOME"),
    overduePayable: over("EXPENSE"),
  };
}

export type DayFlow = { date: string; income: number; expense: number; receivable: number; payable: number };

/** Movimento por dia no período: realizado (pago) e previsto (pendente). */
export async function dailyFlow(from: string, to: string): Promise<DayFlow[]> {
  const rows = await db.financialEntry.groupBy({
    by: ["date", "kind", "status"],
    where: { date: range(from, to), status: { in: ["PAID", "PENDING"] } },
    _sum: { amountCents: true },
  });
  const map = new Map<string, DayFlow>();
  for (const r of rows) {
    const d = dateOnlyToString(r.date);
    const day = map.get(d) ?? { date: d, income: 0, expense: 0, receivable: 0, payable: 0 };
    const v = r._sum.amountCents ?? 0;
    if (r.status === "PAID") day[r.kind === "INCOME" ? "income" : "expense"] += v;
    else day[r.kind === "INCOME" ? "receivable" : "payable"] += v;
    map.set(d, day);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Saldo realizado (receitas pagas − despesas pagas) de tudo que veio antes de `date`. */
export async function openingBalance(date: string): Promise<number> {
  const rows = await db.financialEntry.groupBy({
    by: ["kind"],
    where: { status: "PAID", date: { lt: dateOnly(date) } },
    _sum: { amountCents: true },
  });
  const get = (k: "INCOME" | "EXPENSE") => rows.find((r) => r.kind === k)?._sum.amountCents ?? 0;
  return get("INCOME") - get("EXPENSE");
}

export type EntryFilters = {
  from: string;
  to: string;
  kind?: "INCOME" | "EXPENSE";
  status?: "PAID" | "PENDING" | "CANCELED";
  categoryId?: string;
  q?: string;
};

export function entryWhere(f: EntryFilters): Prisma.FinancialEntryWhereInput {
  return {
    date: range(f.from, f.to),
    ...(f.kind ? { kind: f.kind } : {}),
    // sem filtro de status, cancelados ficam escondidos
    status: f.status ?? { in: ["PAID", "PENDING"] },
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.q ? { OR: [{ description: { contains: f.q, mode: "insensitive" } }, { note: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
}

export { addDays };
