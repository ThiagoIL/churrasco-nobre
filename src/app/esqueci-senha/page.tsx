import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form-kit";
import { requestResetAction } from "@/app/esqueci-senha/actions";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Esqueci minha senha" subtitle="Informe o e-mail do seu usuário para receber o link de redefinição">
      <ActionForm action={requestResetAction} className="space-y-4">
        <TextField name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required autoFocus />
        <SubmitButton size="lg" className="w-full">Enviar link</SubmitButton>
        <p className="text-center text-sm">
          <Link href="/login" className="text-brand-700 underline-offset-2 hover:underline">Voltar ao login</Link>
        </p>
      </ActionForm>
    </AuthShell>
  );
}
