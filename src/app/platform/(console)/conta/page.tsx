import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { Card, PageHeader } from "@/components/ui/primitives";
import { PlatformPasswordForm } from "@/app/platform/forms";

export const metadata: Metadata = { title: "Minha conta · Console" };
export const dynamic = "force-dynamic";

export default async function PlatformAccountPage() {
  const admin = await requirePlatformAdmin({ allowPasswordChange: true });
  return (
    <>
      <PageHeader title="Minha conta" description={`${admin.name} · ${admin.email}`} />
      <Card title="Alterar senha"><PlatformPasswordForm forced={admin.mustChangePassword} /></Card>
    </>
  );
}
