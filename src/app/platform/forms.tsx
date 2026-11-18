"use client";

import { ActionForm, ButtonForm, FormGrid, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { FEATURES, MODULES } from "@/lib/modules";
import {
  blockSystemAction, changePlatformPasswordAction, createPlatformAdminAction, platformLoginAction, resetPlatformAdminPasswordAction,
  setExpiryAction, setFeaturesAction, setModulesAction, togglePlatformAdminAction, unblockSystemAction, updatePlatformProfileAction,
} from "@/app/platform/actions";

export function PlatformLoginForm() {
  return (
    <ActionForm action={platformLoginAction} className="space-y-4">
      <TextField name="email" label="E-mail" type="email" inputMode="email" autoComplete="username" required autoFocus />
      <TextField name="password" label="Senha" type="password" autoComplete="current-password" maxLength={200} required />
      <SubmitButton size="lg" className="w-full">Entrar no console</SubmitButton>
    </ActionForm>
  );
}

export function BlockForm({ blocked }: { blocked: boolean }) {
  if (blocked) {
    return (
      <ActionForm action={unblockSystemAction}>
        <SubmitButton size="lg" confirm="Liberar o acesso do cliente agora?">Liberar acesso</SubmitButton>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={blockSystemAction} className="space-y-3">
      <TextareaField name="message" label="Mensagem para o cliente (aparece na tela “Acesso suspenso”)" rows={2} maxLength={300} placeholder="Ex.: Mensalidade em aberto. Fale com o suporte." />
      <SubmitButton variant="danger" confirm="Bloquear o acesso de todos os usuários agora?">Bloquear acesso</SubmitButton>
    </ActionForm>
  );
}

export function ExpiryForm({ companyName, expiresOn }: { companyName: string; expiresOn: string }) {
  return (
    <ActionForm action={setExpiryAction} className="space-y-3">
      <FormGrid cols={2}>
        <TextField name="companyName" label="Nome da empresa" defaultValue={companyName} required maxLength={80} />
        <TextField name="expiresOn" label="Vencimento do acesso" type="date" defaultValue={expiresOn} hint="Depois desta data o sistema bloqueia sozinho. Deixe vazio para não vencer." />
      </FormGrid>
      <SubmitButton>Salvar</SubmitButton>
    </ActionForm>
  );
}

export function ModulesForm({ enabled }: { enabled: string[] }) {
  return (
    <ActionForm action={setModulesAction} className="space-y-4">
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {MODULES.map((m) => (
          <li key={m.key}>
            <label className="flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3">
              <input type="checkbox" name={`mod_${m.key}`} defaultChecked={enabled.includes(m.key)} className="mt-0.5 size-5 accent-brand-600" />
              <span><span className="block text-sm font-medium">{m.label}</span><span className="block text-xs text-muted">{m.description}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton>Salvar módulos</SubmitButton>
    </ActionForm>
  );
}

export function NewAdminForm() {
  return (
    <ActionForm action={createPlatformAdminAction} resetOnSuccess className="space-y-3">
      <FormGrid cols={2}>
        <TextField name="name" label="Nome" required maxLength={100} />
        <TextField name="email" label="E-mail" type="email" inputMode="email" required />
      </FormGrid>
      <SubmitButton>Criar administrador</SubmitButton>
    </ActionForm>
  );
}

export function AdminRowActions({ id, active, master, self }: { id: string; active: boolean; master: boolean; self: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <ButtonForm action={resetPlatformAdminPasswordAction} showResult fields={{ id }} confirm="Gerar nova senha provisória? A pessoa será desconectada.">Nova senha</ButtonForm>
      {!master && !self && (
        <ButtonForm action={togglePlatformAdminAction} fields={{ id, active: String(!active) }} confirm={active ? "Desativar este administrador?" : undefined}>{active ? "Desativar" : "Reativar"}</ButtonForm>
      )}
    </div>
  );
}

export function PlatformPasswordForm({ forced }: { forced: boolean }) {
  return (
    <ActionForm action={changePlatformPasswordAction} className="space-y-4 max-w-md">
      <TextField name="current" label={forced ? "Senha provisória" : "Senha atual"} type="password" autoComplete="current-password" maxLength={200} required />
      <TextField name="password" label="Nova senha" type="password" autoComplete="new-password" maxLength={200} required hint="10 ou mais caracteres, com letra maiúscula, minúscula e número." />
      <TextField name="confirm" label="Repita a nova senha" type="password" autoComplete="new-password" maxLength={200} required />
      <SubmitButton>Alterar senha</SubmitButton>
    </ActionForm>
  );
}

export function PlatformProfileForm({ name, email }: { name: string; email: string }) {
  return (
    <ActionForm action={updatePlatformProfileAction} className="max-w-md space-y-4">
      <TextField name="name" label="Nome" defaultValue={name} required maxLength={100} />
      <TextField name="email" label="E-mail (é o login)" type="email" inputMode="email" autoComplete="off" defaultValue={email} required />
      <TextField name="current" label="Senha atual (para confirmar)" type="password" autoComplete="current-password" maxLength={200} required />
      <SubmitButton>Salvar dados</SubmitButton>
    </ActionForm>
  );
}

export function FeaturesForm({ enabled }: { enabled: string[] }) {
  return (
    <ActionForm action={setFeaturesAction} className="space-y-4">
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {FEATURES.map((f) => (
          <li key={f.key}>
            <label className="flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3">
              <input type="checkbox" name={`feat_${f.key}`} defaultChecked={enabled.includes(f.key)} className="mt-0.5 size-5 accent-brand-600" />
              <span><span className="block text-sm font-medium">{f.label}</span><span className="block text-xs text-muted">{f.description}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton>Salvar recursos</SubmitButton>
    </ActionForm>
  );
}
