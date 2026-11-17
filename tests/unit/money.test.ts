import { describe, expect, it } from "vitest";
import { centsToInput, formatQty, lineTotal, parseMoney, parseQty, qtyToInput } from "@/lib/money";

describe("parseMoney", () => {
  it("entende formatos brasileiros e simples", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("1234,56")).toBe(123456);
    expect(parseMoney("1234.56")).toBe(123456);
    expect(parseMoney("R$ 10")).toBe(1000);
    expect(parseMoney("0,5")).toBe(50);
    expect(parseMoney("1.234")).toBe(123400);
  });
  it("recusa lixo", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
  it("faz o caminho de volta", () => {
    expect(centsToInput(123456)).toBe("1234,56");
  });
});

describe("parseQty", () => {
  it("lê quantidades em milésimos", () => {
    expect(parseQty("1,5")).toBe(1500);
    expect(parseQty("2")).toBe(2000);
    expect(parseQty("0,250")).toBe(250);
    expect(parseQty("1.500")).toBe(1_500_000); // ponto de milhar
    expect(parseQty("12.5")).toBe(12_500); // ponto decimal
  });
  it("recusa inválidas", () => {
    expect(parseQty("0")).toBeNull();
    expect(parseQty("-1")).toBeNull();
    expect(parseQty("1,2345")).toBeNull();
    expect(parseQty("1,2,3")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("")).toBeNull();
    expect(parseQty("99999999")).toBeNull();
  });
  it("formata para exibição e campos", () => {
    expect(formatQty(1500)).toBe("1,5");
    expect(qtyToInput(1500)).toBe("1,5");
    expect(qtyToInput(2000)).toBe("2");
    expect(qtyToInput(250)).toBe("0,25");
  });
});

describe("lineTotal", () => {
  it("multiplica preço por quantidade arredondando ao centavo", () => {
    expect(lineTotal(5990, 1500)).toBe(8985); // 59,90 × 1,5 kg
    expect(lineTotal(1000, 333)).toBe(333); // 10,00 × 0,333
    expect(lineTotal(1, 500)).toBe(1); // meio centavo arredonda para cima
    expect(lineTotal(0, 5000)).toBe(0);
  });
  it("não perde precisão com valores grandes", () => {
    expect(lineTotal(100_000_000, 1_000_000_000)).toBe(100_000_000_000_000);
  });
});
