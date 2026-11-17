"use client";

import { useState } from "react";
import { ActionForm, FormGrid, SelectField, SubmitButton, TextField } from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { saveUserAction } from "@/app/(app)/usuarios/actions";

export function UserForm({
  profiles, initial,
}: { profiles: { id: string; name: string }[]; initial?: { id: string; name: string; email: string; role: "ADMIN" | "STAFF"; accessProfileId: string | null } }) {
  const [role, setRole] = useState<"ADMIN" | "STAFF">(initial?.role ?? "STAFF");
  return (
    <ActionForm action={saveUserAction} resetOnSuccess className="space-y-4" key={initial?.id ?? "new"}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={2}>
        <TextField name="name" label="Nome" defaultValue={initial?.name} required maxLength={100} />
        <TextField name="email" label="E-mail (é o login)" type="email" inputMode="email" defaultValue={initial?.email} required />
        <div>
          <label htmlFor="role" className="label">Tipo de usuário <span className="text-brand-600">*</span></label>
          <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")} className="input">
            <option value="STAFF">Usuário (segue o perfil de acesso)</option>
            <option value="ADMIN">Administrador (acesso total)</option>
          </select>
        </div>
        {role === "STAFF" && (
          <SelectField name="accessProfileId" label="Perfil de acesso" defaultValue={initial?.accessProfileId ?? ""} placeholder="Escolha…" required options={profiles.map((p) => ({ value: p.id, label: p.name }))} hint={profiles.length === 0 ? "Crie um perfil de acesso primeiro." : undefined} />
        )}
      </FormGrid>
      <div className="flex gap-2">
        <SubmitButton>{initial ? "Salvar" : "Criar usuário"}</SubmitButton>
        {initial && <LinkButton href="/usuarios" variant="ghost">Cancelar</LinkButton>}
      </div>
    </ActionForm>
  );
}
