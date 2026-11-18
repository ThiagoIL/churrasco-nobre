import type { ReactNode } from "react";
import { CadastrosTabs } from "@/components/cadastros-tabs";
import { PageHeader } from "@/components/ui/primitives";
import { loadSettings } from "@/lib/access";

export default async function CadastrosLayout({ children }: { children: ReactNode }) {
  const { features } = await loadSettings();
  const extras = [features.includes("FORNECEDORES") && "fornecedores", features.includes("CLIENTES") && "clientes"].filter(Boolean) as string[];
  const tail = extras.length === 0 ? "" : extras.length === 1 ? ` e ${extras[0]}` : `, ${extras[0]} e ${extras[1]}`;
  return (
    <>
      <PageHeader title="Cadastros" description={`Itens para compra e venda, categorias e formas de pagamento${tail}.`} />
      <CadastrosTabs features={features} />
      {children}
    </>
  );
}
