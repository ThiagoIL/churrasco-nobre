import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/app/login/login-form";
import { param } from "@/components/ui/primitives";
import { safeNext } from "@/lib/auth-utils";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(param(sp.next));
  const notice =
    param(sp.senha) === "redefinida"
      ? "Senha redefinida. Entre com a nova senha."
      : param(sp.sessao) === "encerrada"
        ? "Sua sessão foi encerrada. Entre novamente."
        : null;
  return (
    <AuthShell title="Entrar" subtitle="Acesse o sistema do Churrasco Nobre">
      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{notice}</p>
      )}
      <LoginForm next={next === "/" ? undefined : next} />
    </AuthShell>
  );
}
