import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  const client = globalForPrisma.prisma ?? createClient();
  // Reaproveita a instância em dev (hot reload) e em produção (processo único).
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Cliente do banco criado sob demanda: importar este módulo não exige DATABASE_URL,
 * o que permite `next build` sem acesso ao banco.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Cliente de transação do Prisma. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Executa `fn` em uma transação informando ao banco quem está agindo (`app.actor_id`),
 * para os triggers que impedem alguém de se rebaixar, desativar ou excluir.
 */
export async function withActor<T>(actorId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId}, true)`;
    return fn(tx);
  });
}
