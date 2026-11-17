import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { ButtonForm } from "@/components/ui/form-kit";
import { PasswordForm } from "@/components/password-form";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/dates";
import { describeUserAgent } from "@/lib/auth-utils";
import { SESSION_IDLE_MS } from "@/lib/rules/session";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/app/(app)/conta/actions";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  const now = new Date();
  const sessions = await db.userSession.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: now },
      lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_MS) },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso e os aparelhos conectados." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Meus dados">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-muted">Nome</dt><dd className="font-medium">{user.name}</dd></div>
            <div><dt className="text-xs text-muted">E-mail</dt><dd className="font-medium">{user.email}</dd></div>
            <div><dt className="text-xs text-muted">Perfil</dt><dd><Badge tone={user.role === "ADMIN" ? "brand" : "gray"}>{ROLE_LABELS[user.role]}</Badge></dd></div>
          </dl>
        </Card>

        <Card title="Alterar senha" description="Ao trocar, os outros aparelhos são desconectados.">
          <PasswordForm mode="account" />
        </Card>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Sessões ativas</h2>
          {sessions.length > 1 && (
            <form action={revokeOtherSessionsAction}>
              <button type="submit" className="btn btn-outline btn-sm">Encerrar todas as outras</button>
            </form>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Aparelho</th><th>IP</th><th>Início</th><th>Última atividade</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{describeUserAgent(s.userAgent)}</td>
                  <td className="text-muted">{s.ip ?? "—"}</td>
                  <td>{formatDateTime(s.createdAt)}</td>
                  <td>{formatDateTime(s.lastSeenAt)}</td>
                  <td className="text-right">
                    {s.id === user.sessionId ? (
                      <Badge tone="green">Esta sessão</Badge>
                    ) : (
                      <ButtonForm action={revokeSessionAction} fields={{ id: s.id }} confirm="Encerrar esta sessão?">Encerrar</ButtonForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">A sessão expira em 12 horas ou após 2 horas sem uso.</p>
      </section>
    </>
  );
}
