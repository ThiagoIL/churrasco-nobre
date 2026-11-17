import { z } from "zod";
import { isDateString, isTimeString } from "@/lib/dates";
import { MAX_CENTS, parseMoney, parseQty } from "@/lib/money";

z.config(z.locales.pt());

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Lista de detalhes exibida abaixo da mensagem. */
  details?: string[];
  /** Valores enviados, devolvidos para repreencher o formulário após um erro. */
  values?: Record<string, string>;
  /** Texto que a tela mostra uma única vez (ex.: senha provisória gerada). */
  secret?: string;
};

/** Limite de tamanho de cada campo de texto recebido (defesa contra envios gigantes). */
const MAX_FIELD = 20_000;

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value.slice(0, MAX_FIELD);
  }
  return values;
}

/** Erro de regra de negócio, exibido ao usuário como está. */
export class UserError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

// ── blocos de schema reutilizáveis ──

export const required = (label: string, max = 200) =>
  z
    .string({ error: `${label} é obrigatório` })
    .trim()
    .min(1, `${label} é obrigatório`)
    .max(max, `${label} deve ter no máximo ${max} caracteres`);

export const optional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => v || null);

export const email = () =>
  z
    .string({ error: "E-mail é obrigatório" })
    .trim()
    .toLowerCase()
    .min(1, "E-mail é obrigatório")
    .max(200)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido");

export const uuid = (label: string) =>
  z.string({ error: `Selecione ${label}` }).trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, `Selecione ${label}`);

export const optionalUuid = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), "Valor inválido");

export const requiredEnum = <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `${label} inválido(a)` });

export const money = (label: string, { allowZero = false }: { allowZero?: boolean } = {}) =>
  z
    .string({ error: `${label} é obrigatório` })
    .transform((v, ctx) => {
      const cents = parseMoney(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      if (cents < 0 || (!allowZero && cents === 0)) {
        ctx.addIssue({ code: "custom", message: `${label} deve ser maior que zero` });
        return z.NEVER;
      }
      if (cents > MAX_CENTS) {
        ctx.addIssue({ code: "custom", message: `${label} acima do limite (R$ 10.000.000,00)` });
        return z.NEVER;
      }
      return cents;
    });

export const optionalMoney = (label = "Valor") =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const cents = parseMoney(v);
      if (cents === null || cents < 0 || cents > MAX_CENTS) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      return cents;
    });

/** Quantidade (aceita decimais: "1,5"); devolve milésimos. */
export const quantity = (label = "Quantidade", { allowZero = false }: { allowZero?: boolean } = {}) =>
  z
    .string({ error: `${label} é obrigatória` })
    .transform((v, ctx) => {
      if (allowZero && v.trim() === "0") return 0;
      const milli = parseQty(v);
      if (milli === null) {
        ctx.addIssue({ code: "custom", message: `${label} inválida` });
        return z.NEVER;
      }
      return milli;
    });

export const optionalQuantity = (label = "Quantidade") =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return 0;
      if (v.trim() === "0") return 0;
      const milli = parseQty(v);
      if (milli === null) {
        ctx.addIssue({ code: "custom", message: `${label} inválida` });
        return z.NEVER;
      }
      return milli;
    });

export const dateField = (label: string) =>
  z.string({ error: `${label} é obrigatória` }).refine((v) => isDateString(v), `${label} inválida`);

export const optionalDate = (label: string) =>
  z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || isDateString(v), `${label} inválida`);

export const timeField = (label: string) =>
  z.string({ error: `${label} é obrigatório` }).refine((v) => isTimeString(v), `${label} inválido`);

export const checkbox = () =>
  z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true" || v === "1");

// ── parsing ──

export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { data: z.output<S>; state?: undefined } | { data?: undefined; state: FormState } {
  const raw = formValues(formData);
  const result = schema.safeParse(raw);
  if (result.success) return { data: result.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return { state: { error: "Verifique os campos destacados.", fieldErrors, values: raw } };
}
