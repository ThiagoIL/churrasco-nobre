import { afterEach, describe, expect, it } from "vitest";
import { parseLines } from "@/lib/lines";
import { friendlyDatabaseError, ruleMessage } from "@/lib/db-errors";
import { describeUserAgent, safeNext } from "@/lib/auth-utils";
import { csvMoney, toCsv } from "@/lib/csv";
import { ipFromHeaders } from "@/lib/ip";
import { orderWho, timeAgo } from "@/lib/order-utils";

const uid = "11111111-1111-4111-8111-111111111111";

describe("parseLines", () => {
  it("junta linhas repetidas e lê quantidades e custos", () => {
    const json = JSON.stringify([{ itemId: uid, qty: "1,5", unitCost: "10,00" }, { itemId: uid, qty: "0,5", unitCost: "10,00" }]);
    expect(parseLines(json, { requireCost: true })).toEqual([{ itemId: uid, qtyMilli: 2000, unitCostCents: 1000, note: null }]);
  });
  it("recusa vazio, JSON ruim, ids falsos e quantidades inválidas", () => {
    expect(() => parseLines(undefined)).toThrow(/ao menos um item/);
    expect(() => parseLines("[]")).toThrow(/ao menos um item/);
    expect(() => parseLines("{")).toThrow(/ler os itens/);
    expect(() => parseLines(JSON.stringify([{ itemId: "x", qty: "1" }]))).toThrow();
    expect(() => parseLines(JSON.stringify([{ itemId: uid, qty: "0" }]))).toThrow(/Quantidade inválida/);
    expect(() => parseLines(JSON.stringify([{ itemId: uid, qty: "1" }]), { requireCost: true })).toThrow(/Valor inválido/);
  });
  it("limita a quantidade de linhas", () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ itemId: `${i}`.padStart(8, "0") + uid.slice(8), qty: "1" }));
    expect(() => parseLines(JSON.stringify(many))).toThrow(/No máximo/);
  });
});

describe("erros do banco", () => {
  it("extrai a mensagem das regras do banco", () => {
    expect(ruleMessage(new Error('ERROR: [regra] Estoque insuficiente de "Picanha" (saldo atual: 2).\nCONTEXT: PL/pgSQL'))).toBe('Estoque insuficiente de "Picanha" (saldo atual: 2).');
    expect(ruleMessage(new Error('DbError { message: "[regra] É preciso manter ao menos um administrador ativo.", detail: None }'))).toBe("É preciso manter ao menos um administrador ativo.");
    // formato real do Prisma: a mensagem vem entre sinais de crase, seguida de metadados
    expect(ruleMessage(new Error('Invalid `prisma.stockMovement.create()` invocation: Raw query failed. `[regra] Estoque insuficiente de "Picanha" (saldo atual: 9).` {"modelName":"StockMovement","driverAdapterError":{}}'))).toBe('Estoque insuficiente de "Picanha" (saldo atual: 9).');
    expect(ruleMessage(new Error("outra coisa"))).toBeNull();
  });
  it("traduz duplicidades e vínculos", () => {
    expect(friendlyDatabaseError({ code: "P2002", message: "Unique constraint failed on items_name_ci" })).toBe("Já existe um item com este nome.");
    expect(friendlyDatabaseError({ message: 'duplicate key value violates unique constraint "users_email_key"' })).toBe("Já existe um usuário com este e-mail.");
    expect(friendlyDatabaseError({ code: "P2003", message: "fk" })).toMatch(/em uso/);
    expect(friendlyDatabaseError(new Error("boom"))).toBeNull();
  });
});

describe("utilitários de entrada", () => {
  it("só aceita destinos internos depois do login", () => {
    expect(safeNext("/financeiro?p=hoje")).toBe("/financeiro?p=hoje");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "", undefined, "/login", "/redefinir-senha?token=x"]) expect(safeNext(bad as string)).toBe("/");
  });
  it("descreve o navegador", () => {
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120 Mobile Safari/537")).toBe("Chrome em Android");
    expect(describeUserAgent(null)).toBe("Aparelho desconhecido");
  });
});

describe("CSV", () => {
  it("usa ; e BOM, escapa aspas e bloqueia fórmulas", () => {
    const csv = toCsv(["A", "B"], [["=CMD()", 'diz "oi"; tchau'], ["ok", 1]]);
    expect(csv.startsWith("﻿A;B\r\n")).toBe(true);
    expect(csv).toContain("'=CMD()");
    expect(csv).toContain('"diz ""oi""; tchau"');
    expect(csvMoney(123456)).toBe("1234,56");
    expect(csvMoney(-500)).toBe("-5,00");
  });
});

describe("IP do cliente atrás do proxy", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });
  it("sem TRUST_PROXY ignora cabeçalhos (não dá para forjar)", () => {
    delete process.env.TRUST_PROXY;
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("desconhecido");
  });
  it("com TRUST_PROXY usa a entrada anexada pelo proxy, não a primeira (forjável)", () => {
    process.env.TRUST_PROXY = "true";
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 200.1.2.3" }))).toBe("200.1.2.3");
    process.env.TRUST_PROXY_HOPS = "2";
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
  });
  it("descarta valores que não parecem IP", () => {
    process.env.TRUST_PROXY = "true";
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "<script>" }))).toBe("desconhecido");
  });
});

describe("pedidos", () => {
  it("nomeia o pedido como no salão", () => {
    expect(orderWho({ channel: "TABLE", tableLabel: "7", customerName: null })).toBe("Mesa 7");
    expect(orderWho({ channel: "TABLE", tableLabel: "Varanda", customerName: null })).toBe("Varanda");
    expect(orderWho({ channel: "DELIVERY", tableLabel: null, customerName: "Maria" })).toBe("Maria");
    expect(orderWho({ channel: "COUNTER", tableLabel: null, customerName: null })).toBe("Balcão");
  });
  it("mostra o tempo decorrido", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    expect(timeAgo(new Date("2026-11-17T11:48:00Z"), now)).toBe("há 12 min");
    expect(timeAgo(new Date("2026-11-17T09:00:00Z"), now)).toBe("há 3 h");
    expect(timeAgo(new Date("2026-11-15T12:00:00Z"), now)).toBe("há 2 dias");
  });
});
