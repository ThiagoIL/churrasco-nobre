// Filtros validados da lista de compras (compartilhados com a exportação CSV).
import { resolvePeriod } from "@/lib/period";
import { dateOnly, todayString } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePurchaseParams(sp: SP) {
  const today = todayString();
  const period = resolvePeriod({ p: first(sp.p), de: first(sp.de), ate: first(sp.ate) }, today);
  const supplierRaw = first(sp.fornecedor);
  const supplier = supplierRaw && uuidRe.test(supplierRaw) ? supplierRaw : undefined;
  const statusRaw = first(sp.status);
  const status = statusRaw === "pagas" || statusRaw === "apagar" || statusRaw === "canceladas" ? statusRaw : undefined;
  const q = (first(sp.q) ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Number(first(sp.page)) || 1));

  const where: Prisma.PurchaseWhereInput = {
    date: { gte: dateOnly(period.from), lte: dateOnly(period.to) },
    ...(supplier ? { supplierId: supplier } : {}),
    ...(status === "canceladas" ? { status: "CANCELED" } : { status: "RECEIVED", ...(status === "pagas" ? { paid: true } : status === "apagar" ? { paid: false } : {}) }),
    ...(q ? { OR: [{ invoiceNumber: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }, { note: { contains: q, mode: "insensitive" } }] } : {}),
  };
  return { today, period, supplier, status, q, page, where };
}
