"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { UserError, parseForm, uuid, type FormState } from "@/lib/form";
import { MAX_ATTACHMENTS_PER_PURCHASE, MAX_UPLOAD_BYTES, validateUpload } from "@/lib/uploads";

/** Anexa a foto ou o PDF da nota a uma compra. O tipo é conferido pelo conteúdo do arquivo. */
export async function uploadAttachmentAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("COMPRAS", formData, async (user) => {
    const parsed = parseForm(z.object({ purchaseId: uuid("a compra") }), formData);
    if (parsed.state) return parsed.state;
    const { purchaseId } = parsed.data;

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Escolha uma foto ou um PDF.", { file: "Escolha um arquivo" });
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError("O arquivo passa de 8 MB.", { file: "Arquivo grande demais" });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateUpload(file.name, bytes);
    if (!check.ok) throw new UserError(check.error, { file: check.error });

    const purchase = await db.purchase.findUnique({ where: { id: purchaseId }, select: { id: true, number: true, _count: { select: { attachments: true } } } });
    if (!purchase) throw new UserError("Compra não encontrada.");
    if (purchase._count.attachments >= MAX_ATTACHMENTS_PER_PURCHASE) throw new UserError(`No máximo ${MAX_ATTACHMENTS_PER_PURCHASE} anexos por compra.`);

    await db.$transaction(async (tx) => {
      const created = await tx.purchaseAttachment.create({
        data: { purchaseId, fileName: check.fileName, contentType: check.contentType, sizeBytes: bytes.length, data: bytes, createdById: user.id },
        select: { id: true },
      });
      await audit({ action: "compra.anexou", entity: "compra", entityId: purchaseId, userId: user.id, actor: user.email, data: { numero: purchase.number, arquivo: check.fileName, anexo: created.id } }, tx);
    });
    return { success: "Comprovante anexado." };
  });
}

export async function deleteAttachmentAction(_: FormState, formData: FormData): Promise<FormState> {
  return runAction("COMPRAS", formData, async (user) => {
    const parsed = parseForm(z.object({ id: uuid("o anexo") }), formData);
    if (parsed.state) return parsed.state;
    const att = await db.purchaseAttachment.findUnique({ where: { id: parsed.data.id }, select: { id: true, fileName: true, purchaseId: true } });
    if (!att) throw new UserError("Anexo não encontrado.");
    await db.$transaction(async (tx) => {
      await tx.purchaseAttachment.delete({ where: { id: att.id } });
      await audit({ action: "compra.removeu_anexo", entity: "compra", entityId: att.purchaseId, userId: user.id, actor: user.email, data: { arquivo: att.fileName } }, tx);
    });
    return { success: "Anexo removido." };
  });
}
