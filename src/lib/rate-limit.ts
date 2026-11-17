import "server-only";
import { db } from "@/lib/db";

/**
 * Limitador de tentativas guardado no banco (vale para todas as instâncias e sobrevive a reinícios).
 * Conta a tentativa e devolve `true` quando ainda está dentro do limite da janela.
 */
export async function withinLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - (${windowSeconds}::int * interval '1 second')
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - (${windowSeconds}::int * interval '1 second')
                          THEN now() ELSE rate_limits.window_start END
    RETURNING count`;
  // limpeza ocasional de contadores antigos
  if (Math.random() < 0.01) {
    await db.$executeRaw`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`.catch(() => undefined);
  }
  return Number(rows[0]?.count ?? 1) <= limit;
}

/** Zera um contador (ex.: após login com sucesso). */
export async function resetLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
