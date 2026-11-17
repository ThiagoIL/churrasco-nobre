import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form-kit";
import { param } from "@/components/ui/primitives";
import { resetPasswordAction } from "@/app/redefinir-senha/actions";

export const metadata: Metadata = { title: "Nova senha", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = param((await searchParams).token) ?? "";
  if (token.length < 10) {
    return (
      <AuthShell title="Link inválido">
        <p className="text-center text-sm text-muted">Este link de redefinição não é válido. Peça uma nova recuperação de senha.</p>
        <p className="mt-4 text-center text-sm">
          <Link href="/esqueci-senha" className="text-brand-700 hover:underline">Recuperar senha</Link>
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Criar nova senha" subtitle="Use 10 ou mais caracteres, com letra maiúscula, minúscula e número">
      <ActionForm action={resetPasswordAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <TextField name="password" label="Nova senha" type="password" autoComplete="new-password" maxLength={200} required autoFocus />
        <TextField name="confirm" label="Repita a nova senha" type="password" autoComplete="new-password" maxLength={200} required />
        <SubmitButton size="lg" className="w-full">Salvar nova senha</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
