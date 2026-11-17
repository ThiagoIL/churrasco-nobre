"use client";

import Link from "next/link";
import { ButtonForm } from "@/components/ui/form-kit";
import { deleteEntityAction, toggleActiveAction } from "@/app/(app)/cadastros/actions";

type Entity = "categoria" | "pagamento" | "fornecedor" | "cliente" | "item";

/** Ações de uma linha de cadastro: editar, desativar/reativar e excluir (só quando nunca foi usado). */
export function RowActions({
  entity, id, active, editHref, locked = false, canEdit = true,
}: { entity: Entity; id: string; active: boolean; editHref: string; locked?: boolean; canEdit?: boolean }) {
  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!locked && <Link href={editHref} className="btn btn-outline btn-sm">Editar</Link>}
      {!locked && (
        <ButtonForm action={toggleActiveAction} fields={{ entity, id, active: String(!active) }} confirm={active ? "Desativar? Ele deixa de aparecer nas listas de escolha, mas o histórico é mantido." : undefined}>
          {active ? "Desativar" : "Reativar"}
        </ButtonForm>
      )}
      {!locked && (
        <ButtonForm action={deleteEntityAction} fields={{ entity, id }} variant="ghost" confirm="Excluir definitivamente? Só é possível se nunca foi usado.">
          Excluir
        </ButtonForm>
      )}
      {locked && <span className="text-xs text-muted">Do sistema</span>}
    </div>
  );
}
