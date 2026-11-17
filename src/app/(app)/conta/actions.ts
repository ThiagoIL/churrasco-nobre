"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, uuid, type FormState } from "@/lib/form";
import { audit } from "@/lib/audit";

/** Encerra uma sessão do próprio usuário (outro aparelho, por exemplo). */
export async function revokeSessionAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseForm(z.object({ id: uuid("a sessão") }), formData);
  if (parsed.state) return parsed.state;
  const result = await db.userSession.updateMany({
    where: { id: parsed.data.id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) await audit({ action: "auth.sessao_encerrada", entity: "sessao", entityId: parsed.data.id, userId: user.id, actor: user.email });
  revalidatePath("/conta");
  return { success: "Sessão encerrada." };
}

/** Encerra todas as outras sessões, mantendo a atual. */
export async function revokeOtherSessionsAction(): Promise<void> {
  const user = await requireUser();
  const result = await db.userSession.updateMany({
    where: { userId: user.id, revokedAt: null, id: { not: user.sessionId } },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) {
    await audit({ action: "auth.sessao_encerrada", entity: "sessao", userId: user.id, actor: user.email, data: { quantidade: result.count, todas_as_outras: true } });
  }
  revalidatePath("/conta");
}
