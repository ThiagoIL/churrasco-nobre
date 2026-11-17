import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, safeFileName, sniffType, validateUpload } from "@/lib/uploads";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7\n...");
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("validateUpload", () => {
  it("aceita imagens e PDF cujo conteúdo bate com a extensão", () => {
    expect(validateUpload("nota.jpg", jpeg)).toEqual({ ok: true, fileName: "nota.jpg", contentType: "image/jpeg" });
    expect(validateUpload("NOTA.JPEG", jpeg)).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(validateUpload("a.png", png)).toMatchObject({ ok: true, contentType: "image/png" });
    expect(validateUpload("a.webp", webp)).toMatchObject({ ok: true, contentType: "image/webp" });
    expect(validateUpload("a.pdf", pdf)).toMatchObject({ ok: true, contentType: "application/pdf" });
  });
  it("recusa extensões fora da lista (inclusive executáveis e HTML/SVG)", () => {
    for (const name of ["x.exe", "x.html", "x.svg", "x.js", "x.php", "semextensao", "x.jpg.exe"]) {
      expect(validateUpload(name, jpeg)).toMatchObject({ ok: false });
    }
  });
  it("recusa arquivo disfarçado: extensão não bate com o conteúdo", () => {
    expect(validateUpload("x.jpg", new TextEncoder().encode("<script>alert(1)</script>"))).toMatchObject({ ok: false });
    expect(validateUpload("x.pdf", jpeg)).toMatchObject({ ok: false });
    expect(validateUpload("x.png", jpeg)).toMatchObject({ ok: false });
  });
  it("recusa vazio e acima de 8 MB", () => {
    expect(validateUpload("x.jpg", new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(jpeg);
    expect(validateUpload("x.jpg", big)).toMatchObject({ ok: false, error: expect.stringMatching(/8 MB/) });
  });
});

describe("nome e assinatura", () => {
  it("limpa o nome do arquivo", () => {
    expect(safeFileName("../../etc/passwd.jpg")).toBe("passwd.jpg");
    expect(safeFileName('C:\\fotos\\nota "1".pdf')).toBe("nota 1.pdf");
    expect(safeFileName("")).toBe("comprovante");
    expect(safeFileName("a".repeat(300) + ".jpg").length).toBeLessThanOrEqual(100);
  });
  it("detecta o tipo pelos bytes", () => {
    expect(sniffType(jpeg)).toBe("image/jpeg");
    expect(sniffType(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
