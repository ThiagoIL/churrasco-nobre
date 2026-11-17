import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, param } from "@/components/ui/primitives";
import { PaymentMethodForm } from "@/components/simple-forms";
import { RowActions } from "@/components/row-actions";

export const metadata: Metadata = { title: "Formas de pagamento" };

export default async function PaymentMethodsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { canEdit } = await requireModule("CADASTROS");
  const edit = param((await searchParams).edit);
  const methods = await db.paymentMethod.findMany({ orderBy: { name: "asc" } });
  const editing = canEdit ? methods.find((m) => m.id === edit) : undefined;

  return (
    <div className="max-w-3xl space-y-5">
      {canEdit && (
        <Card title={editing ? "Editar forma de pagamento" : "Nova forma de pagamento"}>
          <PaymentMethodForm initial={editing ? { id: editing.id, name: editing.name } : undefined} />
        </Card>
      )}
      <Card title="Formas de pagamento" padded={false}>
        <ul className="divide-y divide-line">
          {methods.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${m.active ? "" : "opacity-60"}`}>
              <span className="flex items-center gap-2 text-sm font-medium">{m.name}{!m.active && <Badge>Inativa</Badge>}</span>
              <RowActions entity="pagamento" id={m.id} active={m.active} editHref={`/cadastros/pagamentos?edit=${m.id}`} canEdit={canEdit} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
