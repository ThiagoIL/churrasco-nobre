"use client";

import { usePathname } from "next/navigation";
import { LinkTabs } from "@/components/ui/primitives";

const TABS: { href: string; label: string; feature?: string }[] = [
  { href: "/cadastros/itens", label: "Itens e valores" },
  { href: "/cadastros/categorias", label: "Categorias financeiras" },
  { href: "/cadastros/pagamentos", label: "Formas de pagamento" },
  { href: "/cadastros/fornecedores", label: "Fornecedores" },
  { href: "/cadastros/clientes", label: "Clientes", feature: "CLIENTES" },
];

/** `features`: recursos opcionais ligados no console; a aba de um recurso desligado não aparece. */
export function CadastrosTabs({ features }: { features: string[] }) {
  const pathname = usePathname();
  return (
    <LinkTabs
      tabs={TABS.filter((t) => !t.feature || features.includes(t.feature)).map(({ href, label }) => ({ href, label, active: pathname === href || pathname.startsWith(`${href}/`) }))}
    />
  );
}
