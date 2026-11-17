import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { loadSettings } from "@/lib/access";

export const metadata: Metadata = { title: "Acesso suspenso" };
export const dynamic = "force-dynamic";

export default async function BlockedPage() {
  const settings = await loadSettings();
  return (
    <AuthShell>
      <div className="text-center">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-100 text-brand-700">
          <Lock className="size-6" />
        </span>
        <h1 className="text-2xl text-brand-700">Acesso suspenso</h1>
        <p className="mt-3 text-sm text-muted">
          {settings.blockMessage ?? "O acesso a este sistema está temporariamente suspenso. Fale com o fornecedor do sistema."}
        </p>
        <p className="mt-6 text-xs text-muted">Assim que o acesso for liberado, basta recarregar esta página.</p>
      </div>
    </AuthShell>
  );
}
