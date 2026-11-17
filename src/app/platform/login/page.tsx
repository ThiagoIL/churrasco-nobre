import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { PlatformLoginForm } from "@/app/platform/forms";

export const metadata: Metadata = { title: "Console do fornecedor" };

export default function PlatformLoginPage() {
  return (
    <AuthShell title="Console do fornecedor" subtitle="Acesso restrito à administração do sistema">
      <PlatformLoginForm />
    </AuthShell>
  );
}
