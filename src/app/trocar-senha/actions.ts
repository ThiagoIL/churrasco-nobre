"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, startSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { passwordError } from "@/lib/rules/password";
import { parseForm, type FormState } from "@/lib/form";
import { withinLimit } from "@/lib/rate-limit";
import { auditSafe } from "@/lib/audit";

const schema = z
  .object({
    current: z.string().min(1, "Informe a senha atual").max(200),
    password: z.string().max(200),
    confirm: z.string().max(200),
    mode: z.enum(["forced", "account"]).default("account"),
  })
  .superRefine((v, ctx) => {
    const problem = passwordError(v.password);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    else if (v.password === v.current) ctx.addIssue({ code: "custom", path: ["password"], message: "A nova senha deve ser diferente da atual" });
    else if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "As senhas não são iguais" });
  });

/**
 * Troca a própria senha (tela "Minha conta" ou troca obrigatória após senha provisória).
 * Confere a senha atual, grava a nova, revoga todas as sessões (o banco faz isso no trigger) e abre uma nova.
 */
export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const parsed = parseForm(schema, formData);
  if (parsed.state) return { error: parsed.state.error, fieldErrors: parsed.state.fieldErrors };
  const { current, password, mode } = parsed.data;

  if (!(await withinLimit(`pwchange:${user.id}`, 10, 15 * 60))) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return { error: "Verifique os campos destacados.", fieldErrors: { current: "Senha atual incorreta" } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null },
  });
  await startSession(user.id); // as sessões antigas foram revogadas pelo banco; esta é a nova
  await auditSafe({ action: "auth.senha_alterada", entity: "usuario", entityId: user.id, userId: user.id, actor: user.email });

  if (mode === "forced") redirect("/");
  revalidatePath("/conta");
  return { success: "Senha alterada. Os outros aparelhos foram desconectados." };
}
