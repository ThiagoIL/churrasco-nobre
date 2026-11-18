import type { ReactNode } from "react";
import { CadastrosTabs } from "@/components/cadastros-tabs";
import { PageHeader } from "@/components/ui/primitives";
import { loadSettings } from "@/lib/access";

export default async function CadastrosLayout({ children }: { children: ReactNode }) {
  const { features } = await loadSettings();
  return (
    <>
      <PageHeader title="Cadastros" description={`Itens para compra e venda, categorias, formas de pagamento, fornecedores${features.includes("CLIENTES") ? " e clientes" : ""}.`} />
      <CadastrosTabs features={features} />
      {children}
    </>
  );
}
