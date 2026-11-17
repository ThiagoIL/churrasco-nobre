"use server";

import { z } from "zod";
import { db, withActor } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { UserError, email, optionalUuid, parseForm, required, requiredEnum, uuid, type FormState } from "@/lib/form";
import { generateTempPassword, hashPassword } from "@/lib/passwords";
import { userChangeError } from "@/lib/rules/users";

const schema = z.object({
  id: optionalUuid(),
  name: required("Nome", 100),
  email: email(),
  role: requiredEnum(["ADMIN", "STAFF"] as const, "Perfil"),
  accessProfileId: optionalUuid(),
});

async function otherActiveAdmins(excludeId: string) {
  return db.user.count({ where: { role: "ADMIN", active: true, id: { not: excludeId } } });
}

/** Cria (com senha provisória mostrada uma única vez) ou edita um usuário. */
export async function saveUserAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ADMIN", formData, async (actor) => {
    const parsed = parseForm(schema, formData);
    if (parsed.state) return parsed.state;
    const d = parsed.data;
    if (d.role === "STAFF" && !d.accessProfileId) throw new UserError("Escolha o perfil de acesso do usuário.", { accessProfileId: "Escolha o perfil" });
    const profileId = d.role === "ADMIN" ? null : d.accessProfileId;

    if (d.id) {
      const target = await db.user.findUnique({ where: { id: d.id } });
      if (!target) throw new UserError("Usuário não encontrado.");
      const error = userChangeError(actor.id, target, { kind: "setRole", role: d.role }, await otherActiveAdmins(target.id));
      if (error) throw new UserError(error);
      await withActor(actor.id, async (tx) => {
        await tx.user.update({ where: { id: d.id! }, data: { name: d.name, email: d.email, role: d.role, accessProfileId: profileId } });
        await audit({ action: "usuario.editou", entity: "usuario", entityId: d.id, userId: actor.id, actor: actor.email, data: { nome: d.name, email: d.email, perfil: d.role } }, tx);
      });
      return { redirectTo: "/usuarios" };
    }

    const temp = generateTempPassword();
    const created = await db.user.create({
      data: { name: d.name, email: d.email, role: d.role, accessProfileId: profileId, passwordHash: await hashPassword(temp), mustChangePassword: true },
    });
    await audit({ action: "usuario.criou", entity: "usuario", entityId: created.id, userId: actor.id, actor: actor.email, data: { nome: d.name, email: d.email, perfil: d.role } });
    return { success: `Usuário “${d.name}” criado. Passe a senha provisória abaixo para a pessoa: ela vai trocá-la no primeiro acesso.`, secret: temp };
  });
}

export async function toggleUserActiveAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ADMIN", formData, async (actor) => {
    const parsed = parseForm(z.object({ id: uuid("o usuário"), active: z.enum(["true", "false"]) }), formData);
    if (parsed.state) return parsed.state;
    const active = parsed.data.active === "true";
    const target = await db.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) throw new UserError("Usuário não encontrado.");
    if (!active) {
      const error = userChangeError(actor.id, target, { kind: "deactivate" }, await otherActiveAdmins(target.id));
      if (error) throw new UserError(error);
    }
    // o trigger do banco revoga as sessões do usuário desativado
    await withActor(actor.id, async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { active } });
      await audit({ action: active ? "usuario.ativou" : "usuario.desativou", entity: "usuario", entityId: target.id, userId: actor.id, actor: actor.email, data: { email: target.email } }, tx);
    });
    return { success: active ? "Usuário reativado." : "Usuário desativado e desconectado." };
  });
}

/** Gera nova senha provisória (também desbloqueia a conta e desconecta o usuário). */
export async function resetUserPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ADMIN", formData, async (actor) => {
    const parsed = parseForm(z.object({ id: uuid("o usuário") }), formData);
    if (parsed.state) return parsed.state;
    const target = await db.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) throw new UserError("Usuário não encontrado.");
    const temp = generateTempPassword();
    await db.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedAttempts: 0, lockedUntil: null } });
    await audit({ action: "usuario.senha_provisoria", entity: "usuario", entityId: target.id, userId: actor.id, actor: actor.email, data: { email: target.email } });
    return { success: `Senha provisória de ${target.name}:`, secret: temp };
  });
}
