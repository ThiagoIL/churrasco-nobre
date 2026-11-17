"use client";

import Link from "next/link";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form-kit";
import { loginAction } from "@/app/login/actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <TextField name="email" label="E-mail" type="email" autoComplete="username" inputMode="email" required autoFocus />
      <TextField name="password" label="Senha" type="password" autoComplete="current-password" maxLength={200} required />
      <SubmitButton size="lg" className="w-full">Entrar</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/esqueci-senha" className="text-brand-700 underline-offset-2 hover:underline">Esqueci minha senha</Link>
      </p>
    </ActionForm>
  );
}
