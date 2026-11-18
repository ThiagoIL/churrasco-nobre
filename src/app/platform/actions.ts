"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db, withActor } from "@/lib/db";
import { runPlatformAction } from "@/lib/platform-action";
import { endPlatformSession, getPlatformBase, recordPlatformEvent, startPlatformSession, attemptPlatformLogin } from "@/lib/platform-auth";
import { clearSettingsCache } from "@/lib/access";
import { UserError, email, optional, optionalDate, parseForm, required, uuid, type FormState } from "@/lib/form";
import { generateTempPassword, hashPassword, verifyPassword } from "@/lib/passwords";
import { passwordError } from "@/lib/rules/password";
import { platformAdminChangeError } from "@/lib/rules/users";
import { withinLimit } from "@/lib/rate-limit";
import { dateOnly, formatDate } from "@/lib/dates";
import { FEATURES, FEATURE_KEYS, MODULE_KEYS, moduleLabel } from "@/lib/modules";

export async function platformLoginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(z.object({ email: z.string().trim().min(1, "Informe o e-mail").max(200), password: z.string().min(1, "Informe a senha").max(200) }), formData);
  if (parsed.state) return { error: parsed.state.error, fieldErrors: parsed.state.fieldErrors };
  const result = await attemptPlatformLogin(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error, values: { email: parsed.data.email } };
  redirect((await getPlatformBase()) || "/");
}

export async function platformLogoutAction(): Promise<void> {
  const base = await getPlatformBase();
  await endPlatformSession();
  redirect(`${base}/login`);
}

/** Bloqueia o sistema (tela "Acesso suspenso" em segundos) com uma mensagem para o cliente. */
export async function blockSystemAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ message: optional(300) }), formData);
    if (parsed.state) return parsed.state;
    await db.systemSettings.update({ where: { id: "singleton" }, data: { blocked: true, blockMessage: parsed.data.message, blockedAt: new Date() } });
    clearSettingsCache();
    await recordPlatformEvent(admin, "bloqueio", "Sistema bloqueado", { mensagem: parsed.data.message });
    return { success: "Sistema bloqueado. Vale em poucos segundos." };
  });
}

export async function unblockSystemAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    await db.systemSettings.update({ where: { id: "singleton" }, data: { blocked: false, blockMessage: null, blockedAt: null } });
    clearSettingsCache();
    await recordPlatformEvent(admin, "liberacao", "Sistema liberado");
    return { success: "Sistema liberado." };
  });
}

/** Define (ou remove) o vencimento: depois da data o acesso é bloqueado automaticamente. */
export async function setExpiryAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ expiresOn: optionalDate("Vencimento"), companyName: required("Nome da empresa", 80) }), formData);
    if (parsed.state) return parsed.state;
    const { expiresOn, companyName } = parsed.data;
    await db.systemSettings.update({ where: { id: "singleton" }, data: { expiresOn: expiresOn ? dateOnly(expiresOn) : null, companyName } });
    clearSettingsCache();
    await recordPlatformEvent(admin, "vencimento", expiresOn ? `Vencimento definido para ${formatDate(expiresOn)}` : "Vencimento removido", { vencimento: expiresOn, empresa: companyName });
    return { success: "Dados salvos." };
  });
}

export async function setModulesAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const enabled = MODULE_KEYS.filter((k) => formData.get(`mod_${k}`) === "on");
    if (enabled.length === 0) throw new UserError("Deixe ao menos um módulo liberado.");
    const before = await db.systemSettings.findUnique({ where: { id: "singleton" } });
    await db.systemSettings.update({ where: { id: "singleton" }, data: { enabledModules: enabled } });
    clearSettingsCache();
    const was = Array.isArray(before?.enabledModules) ? (before.enabledModules as string[]) : [];
    const added = enabled.filter((k) => !was.includes(k)).map(moduleLabel);
    const removed = was.filter((k) => !enabled.includes(k as never)).map(moduleLabel);
    await recordPlatformEvent(admin, "modulos", `Módulos alterados${added.length ? ` · liberou: ${added.join(", ")}` : ""}${removed.length ? ` · desligou: ${removed.join(", ")}` : ""}`, { liberados: enabled });
    return { success: "Módulos atualizados." };
  });
}

// ───────────────────────── administradores do console ─────────────────────────

export async function createPlatformAdminAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ name: required("Nome", 100), email: email() }), formData);
    if (parsed.state) return parsed.state;
    const temp = generateTempPassword();
    await db.platformAdmin.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(temp), mustChangePassword: true } });
    await recordPlatformEvent(admin, "admin_criado", `Administrador criado: ${parsed.data.email}`);
    return { success: `Administrador criado. Passe a senha provisória:`, secret: temp };
  });
}

export async function togglePlatformAdminAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ id: uuid("o administrador"), active: z.enum(["true", "false"]) }), formData);
    if (parsed.state) return parsed.state;
    const active = parsed.data.active === "true";
    const target = await db.platformAdmin.findUnique({ where: { id: parsed.data.id } });
    if (!target) throw new UserError("Administrador não encontrado.");
    if (!active) {
      const error = platformAdminChangeError(admin.id, target, { kind: "deactivate" });
      if (error) throw new UserError(error);
    }
    await withActor(admin.id, (tx) => tx.platformAdmin.update({ where: { id: target.id }, data: { active } }));
    await recordPlatformEvent(admin, active ? "admin_ativado" : "admin_desativado", `${active ? "Reativou" : "Desativou"} o administrador ${target.email}`);
    return { success: active ? "Reativado." : "Desativado e desconectado." };
  });
}

export async function resetPlatformAdminPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ id: uuid("o administrador") }), formData);
    if (parsed.state) return parsed.state;
    const target = await db.platformAdmin.findUnique({ where: { id: parsed.data.id } });
    if (!target) throw new UserError("Administrador não encontrado.");
    const temp = generateTempPassword();
    await db.platformAdmin.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedAttempts: 0, lockedUntil: null } });
    await recordPlatformEvent(admin, "admin_senha", `Gerou senha provisória para ${target.email}`);
    return { success: `Senha provisória de ${target.name}:`, secret: temp };
  });
}

/** Troca da própria senha no console (também usada na troca obrigatória do primeiro acesso). */
export async function changePlatformPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ current: z.string().min(1, "Informe a senha atual").max(200), password: z.string().max(200), confirm: z.string().max(200) }), formData);
    if (parsed.state) return parsed.state;
    const { current, password, confirm } = parsed.data;
    const problem = passwordError(password);
    if (problem) throw new UserError(problem, { password: problem });
    if (password === current) throw new UserError("A nova senha deve ser diferente da atual.", { password: "Igual à atual" });
    if (password !== confirm) throw new UserError("As senhas não são iguais.", { confirm: "As senhas não são iguais" });
    if (!(await withinLimit(`plat-pw:${admin.id}`, 10, 15 * 60))) throw new UserError("Muitas tentativas. Aguarde alguns minutos.");

    const row = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
    if (!row || !(await verifyPassword(current, row.passwordHash))) throw new UserError("Senha atual incorreta.", { current: "Senha atual incorreta" });
    await db.platformAdmin.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
    await startPlatformSession(admin.id); // o banco revogou as sessões antigas; abre a nova
    await recordPlatformEvent(admin, "senha_alterada", "Alterou a própria senha");
    return { redirectTo: (await getPlatformBase()) || "/" };
  }, { allowPasswordChange: true });
}

/** Altera o próprio nome e e-mail (login) no console. Pede a senha atual para confirmar. */
export async function updatePlatformProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const parsed = parseForm(z.object({ name: required("Nome", 100), email: email(), current: z.string().min(1, "Informe a senha atual").max(200) }), formData);
    if (parsed.state) return parsed.state;
    const { name, email: newEmail, current } = parsed.data;
    if (!(await withinLimit(`plat-profile:${admin.id}`, 10, 15 * 60))) throw new UserError("Muitas tentativas. Aguarde alguns minutos.");

    const row = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { passwordHash: true, name: true, email: true } });
    if (!row || !(await verifyPassword(current, row.passwordHash))) throw new UserError("Senha atual incorreta.", { current: "Senha atual incorreta" });
    if (row.name === name && row.email === newEmail) throw new UserError("Nada foi alterado.");

    // e-mail repetido é traduzido pelo erro de unicidade do banco ("Já existe um administrador com este e-mail.")
    await db.platformAdmin.update({ where: { id: admin.id }, data: { name, email: newEmail } });
    const changes = [row.name !== name ? "nome" : null, row.email !== newEmail ? "e-mail" : null].filter(Boolean).join(" e ");
    await recordPlatformEvent({ id: admin.id, name }, "perfil_alterado", `Alterou o próprio ${changes}`, { de: { nome: row.name, email: row.email }, para: { nome: name, email: newEmail } });
    return { success: "Dados atualizados. No próximo login use o e-mail novo." };
  });
}

/** Liga ou desliga recursos opcionais (ex.: cadastro de clientes). */
export async function setFeaturesAction(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const enabled = FEATURE_KEYS.filter((k) => formData.get(`feat_${k}`) === "on");
    const before = await db.systemSettings.findUnique({ where: { id: "singleton" } });
    const was = Array.isArray(before?.enabledFeatures) ? (before.enabledFeatures as string[]) : [];
    await db.systemSettings.update({ where: { id: "singleton" }, data: { enabledFeatures: enabled } });
    clearSettingsCache();
    const label = (k: string) => FEATURES.find((f) => f.key === k)?.label ?? k;
    const added = enabled.filter((k) => !was.includes(k)).map(label);
    const removed = was.filter((k) => !(enabled as string[]).includes(k)).map(label);
    if (added.length || removed.length) {
      await recordPlatformEvent(admin, "recursos", `Recursos alterados${added.length ? ` · ligou: ${added.join(", ")}` : ""}${removed.length ? ` · desligou: ${removed.join(", ")}` : ""}`, { ligados: enabled });
    }
    return { success: "Recursos atualizados." };
  });
}
