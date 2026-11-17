import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/access";
import { LEVEL_LABELS, MODULES, parsePermissions } from "@/lib/modules";
import { Badge, Card, PageHeader, param } from "@/components/ui/primitives";
import { ButtonForm } from "@/components/ui/form-kit";
import { ProfileForm } from "@/app/(app)/perfis/profile-form";
import { deleteProfileAction } from "@/app/(app)/perfis/actions";

export const metadata: Metadata = { title: "Perfis de acesso" };

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const edit = param((await searchParams).edit);
  const [profiles, settings] = await Promise.all([
    db.accessProfile.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
    loadSettings(),
  ]);
  const editing = profiles.find((p) => p.id === edit);

  return (
    <>
      <PageHeader title="Perfis de acesso" description="Defina o que cada tipo de usuário pode ver e alterar em cada módulo." />
      <Card title={editing ? `Editar perfil: ${editing.name}` : "Novo perfil"} className="mb-5">
        <ProfileForm enabled={settings.enabled} initial={editing ? { id: editing.id, name: editing.name, permissions: parsePermissions(editing.permissions) } : undefined} />
      </Card>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Perfil</th><th>Acessos</th><th>Usuários</th><th></th></tr></thead>
          <tbody>
            {profiles.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">Nenhum perfil ainda. Crie um para liberar usuários que não são administradores.</td></tr>}
            {profiles.map((p) => {
              const perms = parsePermissions(p.permissions);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="space-x-1">
                    {MODULES.filter((m) => perms[m.key]).map((m) => <Badge key={m.key} tone={perms[m.key] === "EDIT" ? "brand" : "gray"}>{m.label}: {LEVEL_LABELS[perms[m.key]!]}</Badge>)}
                  </td>
                  <td>{p._count.users}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/perfis?edit=${p.id}`} className="btn btn-outline btn-sm">Editar</Link>
                      <ButtonForm action={deleteProfileAction} fields={{ id: p.id }} variant="ghost" confirm="Excluir este perfil?">Excluir</ButtonForm>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
