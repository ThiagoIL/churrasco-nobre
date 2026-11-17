"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { UserError, optionalUuid, parseForm, required, uuid, type FormState } from "@/lib/form";
import { MODULE_KEYS, type Permissions } from "@/lib/modules";

export async function saveProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ADMIN", formData, async (actor) => {
    const parsed = parseForm(z.object({ id: optionalUuid(), name: required("Nome do perfil", 60) }), formData);
    if (parsed.state) return parsed.state;

    // nível por módulo: só VIEW e EDIT são gravados (ausente = sem acesso)
    const permissions: Permissions = {};
    for (const key of MODULE_KEYS) {
      const level = String(formData.get(`perm_${key}`) ?? "NONE");
      if (level === "VIEW" || level === "EDIT") permissions[key] = level;
    }
    if (Object.keys(permissions).length === 0) throw new UserError("Dê acesso a pelo menos um módulo.");

    const { id, name } = parsed.data;
    if (id) {
      await db.accessProfile.update({ where: { id }, data: { name, permissions } });
      await audit({ action: "perfil.editou", entity: "perfil", entityId: id, userId: actor.id, actor: actor.email, data: { nome: name, permissoes: permissions } });
      return { redirectTo: "/perfis" };
    }
    const created = await db.accessProfile.create({ data: { name, permissions } });
    await audit({ action: "perfil.criou", entity: "perfil", entityId: created.id, userId: actor.id, actor: actor.email, data: { nome: name, permissoes: permissions } });
    return { success: `Perfil “${name}” criado.` };
  });
}

export async function deleteProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("ADMIN", formData, async (actor) => {
    const parsed = parseForm(z.object({ id: uuid("o perfil") }), formData);
    if (parsed.state) return parsed.state;
    const users = await db.user.count({ where: { accessProfileId: parsed.data.id } });
    if (users > 0) throw new UserError(`Este perfil está em uso por ${users} ${users === 1 ? "usuário" : "usuários"}. Mude o perfil deles antes de excluir.`);
    await db.accessProfile.delete({ where: { id: parsed.data.id } });
    await audit({ action: "perfil.excluiu", entity: "perfil", entityId: parsed.data.id, userId: actor.id, actor: actor.email });
    return { success: "Perfil excluído." };
  });
}
