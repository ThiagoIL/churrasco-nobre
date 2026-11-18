import { describe, expect, it } from "vitest";
import { passwordError, passwordProblems } from "@/lib/rules/password";
import { LOCK_MINUTES, MAX_FAILED_ATTEMPTS, isLocked, registerFailure } from "@/lib/rules/lockout";
import { SESSION_IDLE_MS, SESSION_TTL_MS, needsTouch, sessionState } from "@/lib/rules/session";
import { platformAdminChangeError, userChangeError } from "@/lib/rules/users";
import { applyMovement, isValidReason, stockLevel } from "@/lib/rules/stock";
import { levelFor, moduleForPath, parsePermissions } from "@/lib/modules";

describe("política de senha", () => {
  it("aceita senha forte", () => expect(passwordError("Churrasco2026")).toBeNull());
  it("exige 10+, maiúscula, minúscula e número", () => {
    expect(passwordProblems("Curta1a")).toHaveLength(1);
    expect(passwordProblems("tudominusculo1")).toEqual(["ter uma letra maiúscula"]);
    expect(passwordProblems("TUDOMAIUSCULO1")).toEqual(["ter uma letra minúscula"]);
    expect(passwordProblems("SemNumeroAqui")).toEqual(["ter um número"]);
  });
  it("respeita o limite de 72 bytes do bcrypt", () => {
    expect(passwordError("Aa1" + "x".repeat(80))).toMatch(/72 bytes/);
  });
});

describe("bloqueio de conta", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  it("bloqueia por 15 minutos no 5º erro seguido", () => {
    let state = { failedAttempts: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      state = registerFailure(state, now);
      expect(state.lockedUntil).toBeNull();
      expect(state.failedAttempts).toBe(i);
    }
    state = registerFailure(state, now);
    expect(state.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_MINUTES * 60_000);
    expect(isLocked(state, now)).toBe(true);
    expect(isLocked(state, new Date(now.getTime() + 16 * 60_000))).toBe(false);
  });
  it("recomeça a contagem depois que o bloqueio vence", () => {
    const expired = { failedAttempts: 0, lockedUntil: new Date(now.getTime() - 1000) };
    expect(registerFailure(expired, now)).toEqual({ failedAttempts: 1, lockedUntil: null });
  });
});

describe("validade da sessão", () => {
  const start = new Date("2026-11-17T08:00:00Z");
  const base = { expiresAt: new Date(start.getTime() + SESSION_TTL_MS), lastSeenAt: start, revokedAt: null };
  it("válida logo após o login", () => expect(sessionState(base, start)).toBe("ok"));
  it("expira por inatividade (120 min)", () => {
    expect(sessionState(base, new Date(start.getTime() + SESSION_IDLE_MS))).toBe("ok");
    expect(sessionState(base, new Date(start.getTime() + SESSION_IDLE_MS + 1000))).toBe("idle");
  });
  it("expira em 12 h mesmo com uso", () => {
    const active = { ...base, lastSeenAt: new Date(start.getTime() + SESSION_TTL_MS - 1000) };
    expect(sessionState(active, new Date(start.getTime() + SESSION_TTL_MS + 1))).toBe("expired");
  });
  it("revogada nunca vale", () => expect(sessionState({ ...base, revokedAt: start }, start)).toBe("revoked"));
  it("só regrava a atividade a cada minuto", () => {
    expect(needsTouch({ lastSeenAt: start }, new Date(start.getTime() + 30_000))).toBe(false);
    expect(needsTouch({ lastSeenAt: start }, new Date(start.getTime() + 60_000))).toBe(true);
  });
});

describe("regras de usuários", () => {
  const admin = { id: "a", role: "ADMIN" as const, active: true };
  it("ninguém desativa, exclui ou rebaixa a si mesmo", () => {
    expect(userChangeError("a", admin, { kind: "deactivate" }, 3)).toMatch(/desativar o seu próprio/);
    expect(userChangeError("a", admin, { kind: "delete" }, 3)).toMatch(/excluir o seu próprio/);
    expect(userChangeError("a", admin, { kind: "setRole", role: "STAFF" }, 3)).toMatch(/rebaixar o seu próprio/);
  });
  it("sempre sobra um administrador ativo", () => {
    expect(userChangeError("b", admin, { kind: "deactivate" }, 0)).toMatch(/ao menos um administrador/);
    expect(userChangeError("b", admin, { kind: "setRole", role: "STAFF" }, 0)).toMatch(/ao menos um administrador/);
    expect(userChangeError("b", admin, { kind: "deactivate" }, 1)).toBeNull();
  });
  it("permite alterar usuário comum", () => {
    expect(userChangeError("a", { id: "u", role: "STAFF", active: true }, { kind: "deactivate" }, 0)).toBeNull();
  });
  it("protege a conta master do fornecedor", () => {
    const master = { id: "m", isMaster: true, active: true };
    expect(platformAdminChangeError("x", master, { kind: "deactivate" })).toMatch(/master/);
    expect(platformAdminChangeError("x", master, { kind: "delete" })).toMatch(/master/);
    expect(platformAdminChangeError("x", { id: "x", isMaster: false, active: true }, { kind: "deactivate" })).toMatch(/própria/);
    expect(platformAdminChangeError("m", { id: "y", isMaster: false, active: true }, { kind: "deactivate" })).toBeNull();
  });
});

describe("regras de estoque", () => {
  it("consumo, perda e ajuste de saída não deixam o saldo negativo", () => {
    expect(applyMovement(1000, "OUT", "CONSUMPTION", 1500)).toMatchObject({ ok: false });
    expect(applyMovement(1000, "OUT", "LOSS", 1000)).toEqual({ ok: true, balance: 0 });
    expect(applyMovement(1000, "OUT", "ADJUSTMENT", 1001)).toMatchObject({ ok: false });
  });
  it("venda e estorno podem negativar (nunca travam o caixa)", () => {
    expect(applyMovement(1000, "OUT", "SALE", 3000)).toEqual({ ok: true, balance: -2000 });
    expect(applyMovement(500, "OUT", "REVERSAL", 1000)).toEqual({ ok: true, balance: -500 });
  });
  it("compra só entra; consumo só sai", () => {
    expect(isValidReason("OUT", "PURCHASE")).toBe(false);
    expect(isValidReason("IN", "CONSUMPTION")).toBe(false);
    expect(applyMovement(0, "IN", "PURCHASE", 2500)).toEqual({ ok: true, balance: 2500 });
  });
  it("recusa quantidade inválida", () => {
    expect(applyMovement(0, "IN", "PURCHASE", 0)).toMatchObject({ ok: false });
    expect(applyMovement(0, "IN", "PURCHASE", 1.5)).toMatchObject({ ok: false });
  });
  it("classifica o nível do saldo", () => {
    expect(stockLevel(-1, 0)).toBe("negative");
    expect(stockLevel(0, 5000)).toBe("zero");
    expect(stockLevel(5000, 5000)).toBe("low");
    expect(stockLevel(5001, 5000)).toBe("ok");
    expect(stockLevel(10, 0)).toBe("ok");
  });
});

describe("módulos e permissões", () => {
  it("mapeia rotas para módulos", () => {
    expect(moduleForPath("/financeiro/fluxo")).toBe("FINANCEIRO");
    expect(moduleForPath("/cadastros/itens/novo")).toBe("CADASTROS");
    expect(moduleForPath("/usuarios")).toBe("ADMIN");
    expect(moduleForPath("/auditoria")).toBe("ADMIN");
    expect(moduleForPath("/conta")).toBeNull();
    expect(moduleForPath("/financeiroX")).toBeNull();
  });
  it("módulo desligado pelo fornecedor vale para todos, até administrador", () => {
    expect(levelFor({ role: "ADMIN", permissions: {}, enabled: ["PEDIDOS"] }, "FINANCEIRO")).toBe("NONE");
    expect(levelFor({ role: "ADMIN", permissions: {}, enabled: ["FINANCEIRO"] }, "FINANCEIRO")).toBe("EDIT");
    expect(levelFor({ role: "STAFF", permissions: { PEDIDOS: "VIEW" }, enabled: ["PEDIDOS"] }, "PEDIDOS")).toBe("VIEW");
    expect(levelFor({ role: "STAFF", permissions: {}, enabled: ["PEDIDOS"] }, "PEDIDOS")).toBe("NONE");
  });
  it("ignora permissões inválidas", () => {
    expect(parsePermissions({ PEDIDOS: "EDIT", FINANCEIRO: "TUDO", XYZ: "EDIT" })).toEqual({ PEDIDOS: "EDIT" });
    expect(parsePermissions(null)).toEqual({});
  });
});

import { parseEnabledFeatures } from "@/lib/modules";
describe("recursos opcionais", () => {
  it("começam desligados e ignoram valores desconhecidos", () => {
    expect(parseEnabledFeatures([])).toEqual([]);
    expect(parseEnabledFeatures(null)).toEqual([]);
    expect(parseEnabledFeatures(["CLIENTES", "XYZ"])).toEqual(["CLIENTES"]);
    expect(parseEnabledFeatures(["FORNECEDORES", "CLIENTES"])).toEqual(["CLIENTES", "FORNECEDORES"]);
  });
});
