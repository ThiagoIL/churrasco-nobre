import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/labels";
import { Badge, Card, PageHeader, param } from "@/components/ui/primitives";
import { ButtonForm } from "@/components/ui/form-kit";
import { UserForm } from "@/app/(app)/usuarios/user-form";
import { resetUserPasswordAction, toggleUserActiveAction } from "@/app/(app)/usuarios/actions";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin();
  const edit = param((await searchParams).edit);
  const [users, profiles] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { accessProfile: { select: { name: true } } } }),
    db.accessProfile.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const editing = users.find((u) => u.id === edit);
  const now = new Date();

  return (
    <>
      <PageHeader title="Usuários" description="Quem acessa o sistema. Cada pessoa tem o seu login e um perfil de acesso por módulo." />
      <Card title={editing ? `Editar ${editing.name}` : "Novo usuário"} description={editing ? undefined : "O sistema gera uma senha provisória; a pessoa troca no primeiro acesso."} className="mb-5">
        <UserForm profiles={profiles} initial={editing ? { id: editing.id, name: editing.name, email: editing.email, role: editing.role, accessProfileId: editing.accessProfileId } : undefined} />
      </Card>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Perfil</th><th>Último acesso</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const locked = !!u.lockedUntil && u.lockedUntil > now;
              return (
                <tr key={u.id} className={u.active ? undefined : "opacity-60"}>
                  <td><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{u.email}</span></td>
                  <td><Badge tone={u.role === "ADMIN" ? "brand" : "gray"}>{ROLE_LABELS[u.role]}</Badge></td>
                  <td>{u.role === "ADMIN" ? <span className="text-muted">Acesso total</span> : (u.accessProfile?.name ?? <span className="text-red-600">Sem perfil</span>)}</td>
                  <td className="text-muted">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="space-x-1">
                    {u.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}
                    {locked && <Badge tone="red">Bloqueado</Badge>}
                    {u.mustChangePassword && <Badge tone="amber">Senha provisória</Badge>}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Link href={`/usuarios?edit=${u.id}`} className="btn btn-outline btn-sm">Editar</Link>
                      <ButtonForm action={resetUserPasswordAction} showResult fields={{ id: u.id }} confirm={`Gerar uma nova senha provisória para ${u.name}? Ele(a) será desconectado(a).`}>Nova senha</ButtonForm>
                      {u.id !== me.id && (
                        <ButtonForm action={toggleUserActiveAction} fields={{ id: u.id, active: String(!u.active) }} confirm={u.active ? `Desativar ${u.name}? A pessoa é desconectada na hora.` : undefined}>{u.active ? "Desativar" : "Reativar"}</ButtonForm>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Usuários com histórico não são excluídos: desative-os. Sempre fica pelo menos um administrador ativo, e ninguém consegue desativar ou rebaixar a própria conta.</p>
    </>
  );
}
