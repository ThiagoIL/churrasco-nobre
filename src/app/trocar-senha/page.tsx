import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

export const metadata: Metadata = { title: "Trocar senha" };

/** Primeiro acesso (ou senha provisória): é preciso criar uma senha própria antes de usar o sistema. */
export default async function ForcedPasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  if (!user.mustChangePassword) redirect("/");
  return (
    <AuthShell title="Crie sua senha" subtitle={`Olá, ${user.name.split(" ")[0]}! Por segurança, troque a senha provisória por uma só sua.`}>
      <PasswordForm mode="forced" />
      <form action={logoutAction} className="mt-4 text-center">
        <button type="submit" className="text-sm text-muted underline-offset-2 hover:underline">Sair</button>
      </form>
    </AuthShell>
  );
}
