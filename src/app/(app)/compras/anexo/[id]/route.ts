import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth";
import { hasAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Entrega o comprovante. Defesas: só quem tem acesso a Compras; tipo vindo do banco (já validado pelo conteúdo no envio);
 * `nosniff`; sem cache; CSP "sandbox" (nada executa, mesmo que um arquivo malicioso passasse); PDF sempre baixa
 * em vez de abrir na página.
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccess();
  if (!hasAccess(access, "COMPRAS")) return new Response("Sem acesso", { status: 403 });
  const { id } = await params;
  if (!uuidRe.test(id)) return new Response("Não encontrado", { status: 404 });

  const att = await db.purchaseAttachment.findUnique({ where: { id } });
  if (!att) return new Response("Não encontrado", { status: 404 });

  const asciiName = att.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const inline = att.contentType.startsWith("image/");
  return new Response(att.data as unknown as BodyInit, {
    headers: {
      "Content-Type": att.contentType,
      "Content-Length": String(att.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox; style-src 'unsafe-inline'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
