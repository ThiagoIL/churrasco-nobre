import "server-only";
import { headers } from "next/headers";
import { ipFromHeaders } from "@/lib/ip";

/** IP e navegador da requisição atual (server actions e páginas). */
export async function requestInfo(): Promise<{ ip: string; userAgent: string | null }> {
  try {
    const h = await headers();
    return { ip: ipFromHeaders(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    // fora de uma requisição (bootstrap)
    return { ip: "sistema", userAgent: null };
  }
}
