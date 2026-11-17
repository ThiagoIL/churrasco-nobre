import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { requestInfo } from "@/lib/request-info";

type AuditInput = {
  /** "entidade.verbo", ex.: "financeiro.criou". */
  action: string;
  entity: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
  userId?: string | null;
  /** Quem fez, quando não há usuário válido (ex.: e-mail digitado no login). */
  actor?: string | null;
};

const SECRET_KEY = /senha|password|token|hash/i;

function clean(data: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = SECRET_KEY.test(k) ? "[oculto]" : v;
  return JSON.parse(JSON.stringify(out)) as Prisma.InputJsonValue;
}

/** Grava um registro de auditoria. Passe `tx` para gravar na mesma transação da alteração. */
export async function audit(input: AuditInput, client: Tx | typeof db = db): Promise<void> {
  const { ip } = await requestInfo();
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      actor: input.actor ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      data: clean(input.data),
      ip,
    },
  });
}

/** Versão que nunca lança (login, falhas): a auditoria não pode derrubar o fluxo principal. */
export async function auditSafe(input: AuditInput): Promise<void> {
  try {
    await audit(input);
  } catch (error) {
    console.error("[audit] falhou:", error);
  }
}
