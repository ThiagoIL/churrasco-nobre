// Exportação CSV pensada para o Excel em português: separador ";", BOM UTF-8 e vírgula decimal.

/** Evita "injeção de fórmula": texto que começa com = + - @ vira texto literal no Excel. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** centavos -> "1234,56" */
export const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
/** milésimos -> "1,5" */
export const csvQty = (milli: number) => (milli / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
