import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAccess, requireUser, type CurrentUser } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import type { Access } from "@/lib/modules";
import { UserError, formValues, type FormState } from "@/lib/form";
import { friendlyDatabaseError } from "@/lib/db-errors";

type Outcome = FormState | { redirectTo: string } | void;

/**
 * Executa uma server action com autenticação, conferência do nível "Edita" no módulo, tratamento de erros
 * (regras de negócio e do banco traduzidas) e redirecionamento opcional (feito fora do try/catch,
 * pois redirect() lança).
 */
export async function runAction(
  access: Access | Access[] | null,
  formData: FormData,
  fn: (user: CurrentUser) => Promise<Outcome>,
): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData);
  let outcome: Outcome;
  try {
    if (access) {
      // qualquer um dos módulos informados com nível "Edita" (ou administrador, quando "ADMIN")
      const view = await getAccess();
      const needed = Array.isArray(access) ? access : [access];
      if (!needed.some((a) => hasAccess(view, a, "EDIT"))) {
        throw new UserError(
          needed.includes("ADMIN") && needed.length === 1
            ? "Somente o administrador da empresa pode fazer isto."
            : "Seu perfil de acesso não permite alterar este módulo.",
        );
      }
    }
    outcome = await fn(user);
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, fieldErrors: error.fieldErrors, values };
    const friendly = friendlyDatabaseError(error);
    if (friendly) return { error: friendly, values };
    console.error("[action]", error);
    return { error: "Ocorreu um erro inesperado. Tente novamente.", values };
  }

  revalidatePath("/", "layout");
  if (outcome && "redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome ?? { success: "Salvo com sucesso." };
}
