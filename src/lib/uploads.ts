// Validação de arquivos enviados (comprovantes). Sem dependências de servidor (testável).
// Aceita só imagens e PDF; o tipo real vem do CONTEÚDO (assinatura do arquivo), nunca do nome nem do que o navegador diz.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_ATTACHMENTS_PER_PURCHASE = 10;
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;

export type UploadType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

/** Tipo detectado pela assinatura dos primeiros bytes; null se não for um formato permitido. */
export function sniffType(bytes: Uint8Array): UploadType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

const EXT_TYPE: Record<string, UploadType> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
};

/** Nome seguro para guardar e exibir: sem caminho, sem caracteres de controle, até 100 caracteres. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "comprovante").slice(-100);
}

export type UploadCheck =
  | { ok: true; fileName: string; contentType: UploadType }
  | { ok: false; error: string };

export function validateUpload(name: string, bytes: Uint8Array): UploadCheck {
  const fileName = safeFileName(name);
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { ok: false, error: "Tipo de arquivo não permitido. Envie uma foto (JPG, PNG, WEBP) ou um PDF." };
  }
  if (bytes.length === 0) return { ok: false, error: "O arquivo está vazio." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "O arquivo passa de 8 MB." };
  const real = sniffType(bytes);
  if (!real || real !== EXT_TYPE[ext]) return { ok: false, error: "O conteúdo do arquivo não corresponde a uma foto ou PDF válidos." };
  return { ok: true, fileName, contentType: real };
}
