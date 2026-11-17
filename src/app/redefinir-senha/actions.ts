"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { hashPassword } from "@/lib/passwords";
import { passwordError } from "@/lib/rules/password";
import { parseForm, type FormState } from "@/lib/form";
import { withinLimit } from "@/lib/rate-limit";
import { requestInfo } from "@/lib/request-info";
import { auditSafe } from "@/lib/audit";

const schema = z
  .object({
    token: z.string().min(10).max(128),
    password: z.string().max(200),
    confirm: z.string().max(200),
  })
  .superRefine((v, ctx) => {
    const problem = passwordError(v.password);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    else if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "As senhas não são iguais" });
  });

const INVALID = "Este link é inválido ou expirou. Peça uma nova recuperação de senha.";

/** Define a nova senha com o token do e-mail (uso único, 1 hora). Revoga todas as sessões do usuário. */
export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return { ...parsed.state, values: { token: String(formData.get("token") ?? "") } };
  const { token, password } = parsed.data;
  const { ip } = await requestInfo();

  if (!(await withinLimit(`reset-use:ip:${ip}`, 15, 3600))) return { error: "Muitas tentativas. Aguarde e tente de novo.", values: { token } };

  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now() || !reset.user.active) {
    return { error: INVALID, values: { token } };
  }

  const passwordHash = await hashPassword(password);
  // o trigger do banco revoga as sessões abertas ao trocar a senha
  await db.$transaction([
    db.user.update({
      where: { id: reset.userId },
      data: { passwordHash, mustChangePassword: false, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
    }),
    db.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await auditSafe({ action: "auth.senha_redefinida", entity: "usuario", entityId: reset.userId, userId: reset.userId, actor: reset.user.email });
  redirect("/login?senha=redefinida");
}
