import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { resolvePeriod } from "@/lib/period";
import { endOfDayInstant, formatDateTime, startOfDayInstant, todayString } from "@/lib/dates";
import { AUDIT_ACTION_LABELS, auditActionLabel } from "@/lib/labels";
import { EmptyState, FilterBar, FilterField, PageHeader, Pagination, PeriodFilter, param } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Auditoria" };
const PAGE_SIZE = 50;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function summarize(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  return Object.entries(data as Record<string, unknown>)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const period = resolvePeriod({ p: param(sp.p) ?? "hoje", de: param(sp.de), ate: param(sp.ate) }, todayString());
  const acaoRaw = param(sp.acao);
  const acao = acaoRaw && acaoRaw in AUDIT_ACTION_LABELS ? acaoRaw : undefined;
  const userRaw = param(sp.usuario);
  const usuario = userRaw && uuidRe.test(userRaw) ? userRaw : undefined;
  const q = (param(sp.q) ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Number(param(sp.page)) || 1));

  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: startOfDayInstant(period.from), lt: endOfDayInstant(period.to) },
    entity: { not: "console" }, // o console do fornecedor tem o próprio histórico
    ...(acao ? { action: acao } : {}),
    ...(usuario ? { userId: usuario } : {}),
    ...(q ? { OR: [{ actor: { contains: q, mode: "insensitive" } }, { ip: { contains: q } }, { entity: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, logs, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } } } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const keep = { p: period.key, de: period.key === "periodo" ? period.from : undefined, ate: period.key === "periodo" ? period.to : undefined, acao, usuario, q: q || undefined };

  return (
    <>
      <PageHeader title="Auditoria" description="Registro de tudo que foi feito no sistema, inclusive entradas e tentativas de login recusadas. Não pode ser alterado nem apagado." />
      <PeriodFilter basePath="/auditoria" period={period} params={{ acao, usuario, q: q || undefined }} />
      <FilterBar action="/auditoria">
        <input type="hidden" name="p" value={period.key} />
        {period.key === "periodo" && <><input type="hidden" name="de" value={period.from} /><input type="hidden" name="ate" value={period.to} /></>}
        <FilterField label="Usuário"><select name="usuario" defaultValue={usuario ?? ""} className="input"><option value="">Todos</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FilterField>
        <FilterField label="Ação"><select name="acao" defaultValue={acao ?? ""} className="input"><option value="">Todas</option>{Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FilterField>
        <FilterField label="Buscar" className="min-w-52 flex-1"><input type="search" name="q" defaultValue={q} placeholder="E-mail, IP ou entidade" className="input" /></FilterField>
      </FilterBar>

      {logs.length === 0 ? (
        <EmptyState title="Nenhum registro neste filtro" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhes</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td>{l.user?.name ?? l.actor ?? "—"}{l.user && l.actor && <span className="block text-xs text-muted">{l.actor}</span>}</td>
                  <td className="font-medium">{auditActionLabel(l.action)}</td>
                  <td className="max-w-md text-xs text-muted">{summarize(l.data) || "—"}</td>
                  <td className="whitespace-nowrap text-muted">{l.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/auditoria" params={keep} />
    </>
  );
}
