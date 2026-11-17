"use client";

import { ActionForm, SubmitButton, TextField } from "@/components/ui/form-kit";
import { changePasswordAction } from "@/app/trocar-senha/actions";

/** Formulário de troca de senha (usado em "Minha conta" e na troca obrigatória). */
export function PasswordForm({ mode }: { mode: "forced" | "account" }) {
  return (
    <ActionForm action={changePasswordAction} className="space-y-4" resetOnSuccess>
      <input type="hidden" name="mode" value={mode} />
      <TextField name="current" label={mode === "forced" ? "Senha provisória" : "Senha atual"} type="password" autoComplete="current-password" maxLength={200} required />
      <TextField
        name="password" label="Nova senha" type="password" autoComplete="new-password" maxLength={200} required
        hint="10 ou mais caracteres, com letra maiúscula, minúscula e número."
      />
      <TextField name="confirm" label="Repita a nova senha" type="password" autoComplete="new-password" maxLength={200} required />
      <SubmitButton size="lg" className="w-full sm:w-auto">Alterar senha</SubmitButton>
    </ActionForm>
  );
}
