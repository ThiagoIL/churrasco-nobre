"use client";

import { ActionForm, FormGrid, SelectField, SubmitButton, TextField } from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import {
  saveCategoryAction, saveCustomerAction, savePaymentMethodAction, saveSupplierAction, saveTableAction,
} from "@/app/(app)/cadastros/actions";

function Buttons({ editing, back }: { editing: boolean; back: string }) {
  return (
    <div className="flex items-end gap-2">
      <SubmitButton>{editing ? "Salvar" : "Adicionar"}</SubmitButton>
      {editing && <LinkButton href={back} variant="ghost">Cancelar</LinkButton>}
    </div>
  );
}

export function CategoryForm({ initial }: { initial?: { id: string; name: string; kind: "INCOME" | "EXPENSE" } }) {
  return (
    <ActionForm action={saveCategoryAction} resetOnSuccess className="space-y-3" key={initial?.id ?? "new"}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={3}>
        <TextField name="name" label="Nome da categoria" defaultValue={initial?.name} required maxLength={60} placeholder="Ex.: Gás de cozinha" />
        <SelectField name="kind" label="Tipo" defaultValue={initial?.kind ?? "EXPENSE"} options={[{ value: "INCOME", label: "Receita" }, { value: "EXPENSE", label: "Despesa" }]} required />
        <Buttons editing={!!initial} back="/cadastros/categorias" />
      </FormGrid>
    </ActionForm>
  );
}

export function PaymentMethodForm({ initial }: { initial?: { id: string; name: string } }) {
  return (
    <ActionForm action={savePaymentMethodAction} resetOnSuccess className="space-y-3" key={initial?.id ?? "new"}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={2}>
        <TextField name="name" label="Forma de pagamento" defaultValue={initial?.name} required maxLength={40} placeholder="Ex.: Pix, Cartão de crédito" />
        <Buttons editing={!!initial} back="/cadastros/pagamentos" />
      </FormGrid>
    </ActionForm>
  );
}

export function SupplierForm({ initial }: { initial?: { id: string; name: string; phone: string; document: string; note: string } }) {
  return (
    <ActionForm action={saveSupplierAction} resetOnSuccess className="space-y-3" key={initial?.id ?? "new"}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={4}>
        <TextField name="name" label="Nome do fornecedor" defaultValue={initial?.name} required maxLength={120} span={2} />
        <TextField name="phone" label="Telefone / WhatsApp" defaultValue={initial?.phone} type="tel" inputMode="tel" maxLength={30} />
        <TextField name="document" label="CNPJ/CPF (opcional)" defaultValue={initial?.document} maxLength={30} inputMode="numeric" />
        <TextField name="note" label="Observação" defaultValue={initial?.note} maxLength={300} span={3} />
        <Buttons editing={!!initial} back="/cadastros/fornecedores" />
      </FormGrid>
    </ActionForm>
  );
}

export function CustomerForm({ initial }: { initial?: { id: string; name: string; phone: string; note: string } }) {
  return (
    <ActionForm action={saveCustomerAction} resetOnSuccess className="space-y-3" key={initial?.id ?? "new"}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={4}>
        <TextField name="name" label="Nome do cliente" defaultValue={initial?.name} required maxLength={120} span={2} />
        <TextField name="phone" label="Telefone / WhatsApp" defaultValue={initial?.phone} type="tel" inputMode="tel" maxLength={30} />
        <TextField name="note" label="Observação" defaultValue={initial?.note} maxLength={300} />
        <Buttons editing={!!initial} back="/cadastros/clientes" />
      </FormGrid>
    </ActionForm>
  );
}

export function TableForm({ initial }: { initial?: { id: string; name: string } }) {
  return (
    <ActionForm action={saveTableAction} resetOnSuccess className="space-y-3" key={initial?.id ?? "new"}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormGrid cols={2}>
        <TextField name="name" label="Mesa ou comanda" defaultValue={initial?.name} required maxLength={30} placeholder="Ex.: Mesa 7, Comanda 12, Varanda 2" autoFocus={!initial} />
        <Buttons editing={!!initial} back="/cadastros/mesas" />
      </FormGrid>
    </ActionForm>
  );
}
