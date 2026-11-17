import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { csvMoney, csvResponse, toCsv } from "@/lib/csv";
import { dailyFlow, entryWhere, openingBalance } from "@/lib/finance-queries";
import { parseEntryParams } from "@/lib/entry-params";
import { dateOnlyToString, formatDate } from "@/lib/dates";
import { ENTRY_KIND_LABELS, ENTRY_SOURCE_LABELS, entryStatusLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";
const MAX_ROWS = 20_000;

/** Exporta os lançamentos filtrados (ou o fluxo de caixa, com `visao=fluxo`) em CSV para o Excel. */
export async function GET(request: NextRequest) {
  const access = await getAccess();
  if (!hasAccess(access, "FINANCEIRO")) return new Response("Sem acesso", { status: 403 });

  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { filters, period } = parseEntryParams(sp);

  let body: string;
  let name: string;
  if (sp.visao === "fluxo") {
    const [days, opening] = await Promise.all([dailyFlow(period.from, period.to), openingBalance(period.from)]);
    let running = opening;
    body = toCsv(
      ["Data", "Entradas", "Saídas", "Saldo do dia", "Saldo acumulado", "A receber", "A pagar"],
      days.map((d) => {
        running += d.income - d.expense;
        return [formatDate(d.date), csvMoney(d.income), csvMoney(d.expense), csvMoney(d.income - d.expense), csvMoney(running), csvMoney(d.receivable), csvMoney(d.payable)];
      }),
    );
    name = `fluxo-de-caixa_${period.from}_a_${period.to}.csv`;
  } else {
    const entries = await db.financialEntry.findMany({
      where: entryWhere(filters),
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: MAX_ROWS,
      include: { category: { select: { name: true } }, paymentMethod: { select: { name: true } }, supplier: { select: { name: true } }, customer: { select: { name: true } } },
    });
    body = toCsv(
      ["Data", "Tipo", "Descrição", "Categoria", "Forma de pagamento", "Fornecedor/Cliente", "Valor", "Situação", "Origem", "Observação"],
      entries.map((e) => [
        formatDate(dateOnlyToString(e.date)), ENTRY_KIND_LABELS[e.kind], e.description, e.category.name, e.paymentMethod?.name ?? "",
        e.supplier?.name ?? e.customer?.name ?? "", csvMoney(e.kind === "EXPENSE" ? -e.amountCents : e.amountCents),
        entryStatusLabel(e.kind, e.status), ENTRY_SOURCE_LABELS[e.source], e.note ?? "",
      ]),
    );
    name = `lancamentos_${period.from}_a_${period.to}.csv`;
  }

  await audit({ action: "exportacao.csv", entity: "financeiro", userId: access.user.id, actor: access.user.email, data: { arquivo: name } });
  return csvResponse(name, body);
}
