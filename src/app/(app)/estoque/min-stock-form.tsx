"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form-kit";
import { setMinStockAction } from "@/app/(app)/estoque/actions";

/** Estoque mínimo editável na própria linha do saldo. */
export function MinStockForm({ itemId, itemName, value }: { itemId: string; itemName: string; value: string }) {
  return (
    <ActionForm action={setMinStockAction} className="inline-flex items-center justify-end gap-1.5" key={`${itemId}-${value}`}>
      <input type="hidden" name="itemId" value={itemId} />
      <input
        name="minStock" type="text" inputMode="decimal" autoComplete="off" defaultValue={value} placeholder="0" maxLength={14}
        aria-label={`Estoque mínimo de ${itemName}`} className="input h-9 w-20 px-2 text-right tabular-nums"
      />
      <SubmitButton variant="outline" size="sm">Salvar</SubmitButton>
    </ActionForm>
  );
}
