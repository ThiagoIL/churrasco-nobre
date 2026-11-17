import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { csvMoney, csvQty, csvResponse, toCsv } from "@/lib/csv";
import { lineTotal } from "@/lib/money";
import { stockLevel } from "@/lib/rules/stock";
import { todayString } from "@/lib/dates";

export const dynamic = "force-dynamic";
const LEVEL = { ok: "Ok", low: "Baixo", zero: "Zerado", negative: "Negativo" } as const;

/** Exporta o saldo atual do estoque em CSV. */
export async function GET() {
  const access = await getAccess();
  if (!hasAccess(access, "ESTOQUE")) return new Response("Sem acesso", { status: 403 });
  const items = await db.item.findMany({ where: { active: true, trackStock: true }, orderBy: { name: "asc" }, take: 20_000 });
  const name = `estoque_${todayString()}.csv`;
  await audit({ action: "exportacao.csv", entity: "estoque", userId: access.user.id, actor: access.user.email, data: { arquivo: name } });
  return csvResponse(name, toCsv(
    ["Item", "Código", "Grupo", "Unidade", "Saldo", "Mínimo", "Custo unitário", "Valor em estoque", "Situação"],
    items.map((i) => [i.name, i.code ?? "", i.groupName ?? "", i.unit, csvQty(i.stockQtyMilli), csvQty(i.minStockMilli), csvMoney(i.costCents), csvMoney(i.stockQtyMilli > 0 ? lineTotal(i.costCents, i.stockQtyMilli) : 0), LEVEL[stockLevel(i.stockQtyMilli, i.minStockMilli)]]),
  ));
}
