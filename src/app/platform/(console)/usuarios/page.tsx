import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { AdminRowActions, NewAdminForm } from "@/app/platform/forms";

export const metadata: Metadata = { title: "Administradores · Console" };
export const dynamic = "force-dynamic";

export default async function PlatformAdminsPage() {
  const me = await requirePlatformAdmin();
  const admins = await db.platformAdmin.findMany({ orderBy: [{ isMaster: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Administradores do console" description="Quem pode bloquear, liberar e configurar este sistema. A conta master não pode ser desativada nem excluída." />
      <Card title="Novo administrador" description="Gera uma senha provisória, mostrada uma única vez." className="mb-5"><NewAdminForm /></Card>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nome</th><th>Último acesso</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className={a.active ? undefined : "opacity-60"}>
                <td><span className="font-medium">{a.name}</span><span className="block text-xs text-muted">{a.email}</span></td>
                <td className="text-muted">{formatDateTime(a.lastLoginAt)}</td>
                <td className="space-x-1">{a.isMaster && <Badge tone="gold">Master</Badge>}{a.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}{a.mustChangePassword && <Badge tone="amber">Senha provisória</Badge>}</td>
                <td><AdminRowActions id={a.id} active={a.active} master={a.isMaster} self={a.id === me.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
