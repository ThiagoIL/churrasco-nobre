import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { loadSettings } from "@/lib/access";
import { Card, PageHeader } from "@/components/ui/primitives";
import { FeaturesForm, ModulesForm } from "@/app/platform/forms";

export const metadata: Metadata = { title: "Módulos · Console" };
export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  await requirePlatformAdmin();
  const settings = await loadSettings();
  return (
    <>
      <PageHeader title="Módulos" description="O que o cliente pode usar. Módulos desligados somem do menu e ficam bloqueados para todos, inclusive administradores." />
      <Card><ModulesForm enabled={settings.enabled} /></Card>
      <div className="mt-8" />
      <PageHeader title="Recursos opcionais" description="Partes de um módulo que ficam desligadas até você liberar. Desligadas, somem do menu e das telas." />
      <Card><FeaturesForm enabled={settings.features} /></Card>
    </>
  );
}
