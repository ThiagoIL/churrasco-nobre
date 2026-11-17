"use client";

import { FileText, ImageIcon } from "lucide-react";
import { ActionForm, ButtonForm, FileField, SubmitButton } from "@/components/ui/form-kit";
import { deleteAttachmentAction, uploadAttachmentAction } from "@/app/(app)/compras/anexos";

export type AttachmentView = { id: string; fileName: string; contentType: string; sizeBytes: number; createdAt: string };

const size = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Comprovantes da compra: abrir, baixar, remover e anexar outro. */
export function AttachmentsCard({ purchaseId, attachments, canEdit }: { purchaseId: string; attachments: AttachmentView[]; canEdit: boolean }) {
  return (
    <div className="space-y-4">
      {attachments.length === 0 ? (
        <p className="text-sm text-muted">Nenhum comprovante anexado.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
              {a.contentType === "application/pdf" ? <FileText className="size-5 shrink-0 text-brand-600" /> : <ImageIcon className="size-5 shrink-0 text-brand-600" />}
              <div className="min-w-0 flex-1">
                <a href={`/compras/anexo/${a.id}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-brand-700 hover:underline">{a.fileName}</a>
                <p className="text-xs text-muted">{size(a.sizeBytes)} · {a.createdAt}</p>
              </div>
              {canEdit && <ButtonForm action={deleteAttachmentAction} fields={{ id: a.id }} variant="ghost" confirm="Remover este comprovante?">Remover</ButtonForm>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <ActionForm action={uploadAttachmentAction} resetOnSuccess className="space-y-3">
          <input type="hidden" name="purchaseId" value={purchaseId} />
          <FileField name="file" label="Anexar foto ou PDF da nota" />
          <SubmitButton variant="outline">Anexar</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
