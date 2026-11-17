"use client";

import { ActionForm, FormActions, SubmitButton, TextField } from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { LEVEL_LABELS, MODULES, type Permissions } from "@/lib/modules";
import { saveProfileAction } from "@/app/(app)/perfis/actions";

export function ProfileForm({ initial, enabled }: { initial?: { id: string; name: string; permissions: Permissions }; enabled: string[] }) {
  return (
    <ActionForm action={saveProfileAction} resetOnSuccess key={initial?.id ?? "new"} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="max-w-sm"><TextField name="name" label="Nome do perfil" defaultValue={initial?.name} required maxLength={60} placeholder="Ex.: Garçom, Caixa, Gerente" /></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Módulo</th><th className="w-56">Acesso</th></tr></thead>
          <tbody>
            {MODULES.map((m) => {
              const off = !enabled.includes(m.key);
              return (
                <tr key={m.key} className={off ? "opacity-50" : undefined}>
                  <td><span className="font-medium">{m.label}</span>{off && <span className="ml-2 text-xs text-muted">(desligado pelo fornecedor)</span>}<span className="block text-xs text-muted">{m.description}</span></td>
                  <td>
                    <select name={`perm_${m.key}`} defaultValue={initial?.permissions[m.key] ?? "NONE"} aria-label={`Acesso a ${m.label}`} className="input">
                      <option value="NONE">{LEVEL_LABELS.NONE}</option>
                      <option value="VIEW">{LEVEL_LABELS.VIEW} (só vê)</option>
                      <option value="EDIT">{LEVEL_LABELS.EDIT} (vê e altera)</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FormActions>
        <SubmitButton>{initial ? "Salvar perfil" : "Criar perfil"}</SubmitButton>
        {initial && <LinkButton href="/perfis" variant="ghost">Cancelar</LinkButton>}
      </FormActions>
    </ActionForm>
  );
}
