"use client";

import { usePathname } from "next/navigation";
import { LinkTabs } from "@/components/ui/primitives";

const TABS = [
  { href: "/cadastros/itens", label: "Itens e valores" },
  { href: "/cadastros/categorias", label: "Categorias financeiras" },
  { href: "/cadastros/pagamentos", label: "Formas de pagamento" },
  { href: "/cadastros/fornecedores", label: "Fornecedores" },
  { href: "/cadastros/clientes", label: "Clientes" },
];

export function CadastrosTabs() {
  const pathname = usePathname();
  return <LinkTabs tabs={TABS.map((t) => ({ ...t, active: pathname === t.href || pathname.startsWith(`${t.href}/`) }))} />;
}
