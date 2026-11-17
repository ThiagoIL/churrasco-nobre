import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Verificação de saúde (Docker/Easypanel): confirma que o servidor responde e que o banco está acessível. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
