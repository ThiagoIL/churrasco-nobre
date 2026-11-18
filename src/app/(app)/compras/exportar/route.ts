import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import { featureOn } from "@/lib/features";
import { audit } from "@/lib/audit";
import { csvMoney, csvQty, csvResponse, toCsv } from "@/lib/csv";
import { parsePurchaseParams } from "@/lib/purchase-params";
import { dateOnlyToString, formatDate } from "@/lib/dates";
import { PURCHASE_STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Exporta as compras filtradas em CSV, uma linha por item comprado. */
export async function GET(request: NextRequest) {
  const access = await getAccess();
  if (!hasAccess(access, "COMPRAS")) return new Response("Sem acesso", { status: 403 });
  const suppliersOn = await featureOn("FORNECEDORES");
  const { where, period } = parsePurchaseParams(Object.fromEntries(request.nextUrl.searchParams.entries()), suppliersOn);

  const purchases = await db.purchase.findMany({
    where, orderBy: [{ date: "asc" }, { number: "asc" }], take: 5000,
    include: { supplier: { select: { name: true } }, items: { include: { item: { select: { name: true, unit: true } } } } },
  });
  const rows = purchases.flatMap((p) =>
    p.items.map((l) => [
      p.number, formatDate(dateOnlyToString(p.date)), p.supplier?.name ?? "", p.invoiceNumber ?? "", l.item.name, csvQty(l.qtyMilli), l.item.unit,
      csvMoney(l.unitCostCents), csvMoney(l.totalCents), csvMoney(p.totalCents), PURCHASE_STATUS_LABELS[p.status], p.paid ? "Paga" : "A pagar",
    ]),
  );
  const name = `compras_${period.from}_a_${period.to}.csv`;
  await audit({ action: "exportacao.csv", entity: "compras", userId: access.user.id, actor: access.user.email, data: { arquivo: name } });
  return csvResponse(name, toCsv(["Nº", "Data", "Fornecedor", "Nota", "Item", "Quantidade", "Unidade", "Custo unitário", "Total do item", "Total da compra", "Situação", "Pagamento"], rows));
}
