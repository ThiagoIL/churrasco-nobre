import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { loadSettings } from "@/lib/access";
import { dateOnlyToString, formatDateTime } from "@/lib/dates";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BlockForm, ExpiryForm } from "@/app/platform/forms";

export const metadata: Metadata = { title: "Situação · Console" };
export const dynamic = "force-dynamic";

export default async function PlatformHome() {
  await requirePlatformAdmin();
  const [settings, raw, users, lastEvents] = await Promise.all([
    loadSettings(),
    db.systemSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    db.user.count({ where: { active: true } }),
    db.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <>
      <PageHeader title={settings.companyName} description="Situação do acesso do cliente a este sistema." actions={settings.blocked ? <Badge tone="red">Bloqueado</Badge> : <Badge tone="green">Liberado</Badge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Bloqueio" description="Bloqueado, todos os usuários veem a tela “Acesso suspenso” em poucos segundos.">
          {settings.blocked && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {raw.blocked ? <>Bloqueado desde {formatDateTime(raw.blockedAt)}.{raw.blockMessage ? ` Mensagem: “${raw.blockMessage}”` : ""}</> : <>Bloqueado automaticamente: o vencimento passou.</>}
            </p>
          )}
          {raw.blocked || !settings.blocked ? <BlockForm blocked={raw.blocked} /> : <p className="text-sm text-muted">Estenda o vencimento ao lado para liberar.</p>}
        </Card>
        <Card title="Empresa e vencimento" description="Bloqueio automático por vencimento.">
          <ExpiryForm companyName={raw.companyName} expiresOn={raw.expiresOn ? dateOnlyToString(raw.expiresOn) : ""} />
        </Card>
        <Card title="Resumo">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Usuários ativos</dt><dd className="font-medium">{users}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Módulos liberados</dt><dd className="font-medium">{settings.enabled.length}</dd></div>
          </dl>
        </Card>
        <Card title="Últimos eventos" padded={false}>
          <ul className="divide-y divide-line text-sm">
            {lastEvents.length === 0 && <li className="px-5 py-6 text-center text-muted">Nada ainda.</li>}
            {lastEvents.map((e) => <li key={e.id} className="px-5 py-3"><span className="block font-medium">{e.message}</span><span className="text-xs text-muted">{formatDateTime(e.createdAt)} · {e.adminName}</span></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
