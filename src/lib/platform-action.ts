import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, type CurrentAdmin } from "@/lib/platform-auth";
import { UserError, formValues, type FormState } from "@/lib/form";
import { friendlyDatabaseError } from "@/lib/db-errors";

type Outcome = FormState | { redirectTo: string } | void;

/** Como runAction, para o console do fornecedor (exige sessão de administrador do sistema). */
export async function runPlatformAction(
  formData: FormData,
  fn: (admin: CurrentAdmin) => Promise<Outcome>,
  options: { allowPasswordChange?: boolean } = {},
): Promise<FormState> {
  const admin = await requirePlatformAdmin(options);
  const values = formValues(formData);
  let outcome: Outcome;
  try {
    outcome = await fn(admin);
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, fieldErrors: error.fieldErrors, values };
    const friendly = friendlyDatabaseError(error);
    if (friendly) return { error: friendly, values };
    console.error("[platform-action]", error);
    return { error: "Ocorreu um erro inesperado. Tente novamente.", values };
  }
  revalidatePath("/", "layout");
  if (outcome && "redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome ?? { success: "Salvo com sucesso." };
}
