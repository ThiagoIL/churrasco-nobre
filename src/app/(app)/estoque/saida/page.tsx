import type { Metadata } from "next";
import { requireModule } from "@/lib/auth";
import { catalogItems } from "@/lib/catalog";
import { Card, LinkTabs, PageHeader } from "@/components/ui/primitives";
import { StockAdjustForm, StockOutForm } from "@/app/(app)/estoque/saida/stock-forms";

export const metadata: Metadata = { title: "Consumo, perda e ajuste" };

export default async function StockOutPage() {
  await requireModule("ESTOQUE", "EDIT");
  const items = await catalogItems({ trackStock: true });
  return (
    <>
      <PageHeader title="Estoque" description="Lance o que foi consumido ou perdido, ou ajuste o saldo depois de contar." />
      <LinkTabs tabs={[
        { href: "/estoque", label: "Saldo dos itens", active: false },
        { href: "/estoque/movimentacoes", label: "Movimentações", active: false },
        { href: "/estoque/saida", label: "Consumo, perda e ajuste", active: true },
      ]} />
      <div className="max-w-4xl space-y-6">
        <Card title="Saída de estoque" description="Consumo e perdas baixam o saldo. O sistema não deixa o saldo ficar negativo.">
          <StockOutForm items={items} />
        </Card>
        <Card title="Ajuste de inventário" description="Contou o estoque e o saldo não bate? Informe a quantidade real.">
          <StockAdjustForm items={items} />
        </Card>
      </div>
    </>
  );
}
