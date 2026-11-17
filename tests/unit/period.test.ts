import { describe, expect, it } from "vitest";
import { eachDay, previousPeriod, resolvePeriod } from "@/lib/period";
import { endOfMonth, isDateString, localParts, todayString } from "@/lib/dates";

describe("resolvePeriod", () => {
  const today = "2026-11-17";
  it("padrão é o mês atual", () => {
    const p = resolvePeriod({}, today);
    expect(p).toMatchObject({ key: "mes", from: "2026-11-01", to: "2026-11-30" });
  });
  it("hoje", () => {
    expect(resolvePeriod({ p: "hoje" }, today)).toMatchObject({ key: "hoje", from: today, to: today });
  });
  it("mês anterior atravessa o ano", () => {
    expect(resolvePeriod({ p: "mes-anterior" }, "2026-01-10")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("período livre, inclusive com datas invertidas", () => {
    expect(resolvePeriod({ p: "periodo", de: "2026-10-05", ate: "2026-10-01" }, today)).toMatchObject({ from: "2026-10-01", to: "2026-10-05" });
  });
  it("período com datas inválidas cai no mês, mantendo a aba", () => {
    expect(resolvePeriod({ p: "periodo", de: "2026-13-40", ate: "x" }, today)).toMatchObject({ key: "periodo", from: "2026-11-01" });
  });
  it("valor desconhecido vira mês atual", () => {
    expect(resolvePeriod({ p: "qualquer" }, today).key).toBe("mes");
  });
  it("limita intervalos gigantes", () => {
    const p = resolvePeriod({ p: "periodo", de: "1990-01-01", ate: "2026-01-01" }, today);
    expect(p.from > "2020-01-01").toBe(true);
  });
});

describe("previousPeriod e eachDay", () => {
  it("mês anterior ao mês", () => {
    expect(previousPeriod(resolvePeriod({}, "2026-03-15"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("mesmo tamanho para intervalos livres", () => {
    expect(previousPeriod(resolvePeriod({ p: "periodo", de: "2026-11-10", ate: "2026-11-16" }, "2026-11-17"))).toEqual({ from: "2026-11-03", to: "2026-11-09" });
  });
  it("lista os dias", () => {
    expect(eachDay("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});

describe("datas", () => {
  it("valida calendário", () => {
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });
  it("usa o horário de Brasília para decidir o dia", () => {
    expect(todayString(new Date("2026-11-17T02:30:00Z"))).toBe("2026-11-16"); // 23:30 do dia 16 em Brasília
    expect(localParts(new Date("2026-11-17T15:00:00Z"))).toEqual({ date: "2026-11-17", time: "12:00" });
  });
});
