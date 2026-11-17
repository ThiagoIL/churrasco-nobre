// Dinheiro em centavos e quantidades em milésimos da unidade. Sem dependências de servidor.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const qtyFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/** Maior valor aceito em um lançamento (R$ 10.000.000,00), igual ao CHECK do banco. */
export const MAX_CENTS = 1_000_000_000;
/** Maior quantidade aceita (1.000.000 unidades), em milésimos. */
export const MAX_QTY_MILLI = 1_000_000_000;

export const formatMoney = (cents: number | null | undefined) => brl.format((cents ?? 0) / 100);

/** Valor com sinal, para fluxo de caixa: "+ R$ 10,00" / "− R$ 10,00". */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatMoney(0);
  return `${cents > 0 ? "+" : "−"} ${formatMoney(Math.abs(cents))}`;
}

/** Converte "1.234,56", "1234,56", "1234.56" ou "R$ 10" em centavos. Retorna null se inválido. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/[^\d.,-]/g, "").trim();
  if (!s || s === "-") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // o último separador é o decimal
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  } else if (lastDot > -1) {
    // "1.234" (milhar) vs "12.5" (decimal)
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && s.indexOf(".") === lastDot) s = s.replace(".", "");
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** centavos -> "1234,56" (para preencher campos). */
export const centsToInput = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");

/**
 * Converte uma quantidade digitada ("1,5", "2", "0,250", "1.500") em milésimos.
 * Vírgula é o decimal; ponto só é milhar quando seguido de exatamente 3 dígitos ("1.500" = 1500).
 * Retorna null se inválida (mais de 3 casas, negativa, vazia).
 */
export function parseQty(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim().replace(/\s/g, "");
  if (!s || !/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(",")) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    return null;
  }
  const [intPart, frac = ""] = s.split(".");
  if (frac.length > 3) return null;
  const milli = Number(intPart) * 1000 + Number(frac.padEnd(3, "0") || "0");
  if (!Number.isSafeInteger(milli) || milli <= 0 || milli > MAX_QTY_MILLI) return null;
  return milli;
}

/** milésimos -> "1,5" (exibição). */
export const formatQty = (milli: number | null | undefined) => qtyFmt.format((milli ?? 0) / 1000);

/** milésimos -> "1,5" (para preencher campos, sem separador de milhar). */
export function qtyToInput(milli: number | null | undefined): string {
  if (milli == null) return "";
  return (milli / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

/** Total de uma linha: preço por unidade × quantidade (milésimos), arredondado ao centavo. */
export function lineTotal(unitCents: number, qtyMilli: number): number {
  return Number((BigInt(unitCents) * BigInt(qtyMilli) + 500n) / 1000n);
}
