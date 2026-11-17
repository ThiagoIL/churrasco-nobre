import type { ReactNode } from "react";
import { CadastrosTabs } from "@/components/cadastros-tabs";
import { PageHeader } from "@/components/ui/primitives";

export default function CadastrosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Cadastros" description="Itens para compra e venda, categorias, formas de pagamento, fornecedores e clientes." />
      <CadastrosTabs />
      {children}
    </>
  );
}
