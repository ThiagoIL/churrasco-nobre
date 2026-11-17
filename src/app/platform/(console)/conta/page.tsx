import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { Card, PageHeader } from "@/components/ui/primitives";
import { PlatformPasswordForm, PlatformProfileForm } from "@/app/platform/forms";

export const metadata: Metadata = { title: "Minha conta · Console" };
export const dynamic = "force-dynamic";

export default async function PlatformAccountPage() {
  const admin = await requirePlatformAdmin({ allowPasswordChange: true });
  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso ao console do fornecedor." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Meus dados" description="Nome e e-mail usados no login do console."><PlatformProfileForm name={admin.name} email={admin.email} /></Card>
        <Card title="Alterar senha"><PlatformPasswordForm forced={admin.mustChangePassword} /></Card>
      </div>
    </>
  );
}
