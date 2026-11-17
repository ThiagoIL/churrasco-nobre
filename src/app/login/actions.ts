"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin, endSession, getSession } from "@/lib/auth";
import { parseForm, type FormState } from "@/lib/form";
import { auditSafe } from "@/lib/audit";
import { safeNext } from "@/lib/auth-utils";

const schema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").max(200),
  password: z.string().min(1, "Informe a senha").max(200),
  next: z.string().max(500).optional(),
});

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) {
    return { error: parsed.state.error, fieldErrors: parsed.state.fieldErrors, values: { email: String(formData.get("email") ?? "").slice(0, 200) } };
  }

  const result = await attemptLogin(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error, values: { email: parsed.data.email } };
  redirect(result.mustChangePassword ? "/trocar-senha" : safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await endSession();
  if (session) await auditSafe({ action: "auth.logout", entity: "auth", userId: session.user.id, actor: session.user.email });
  redirect("/login");
}
