// IP do cliente. Atrás de proxy (Easypanel/Traefik) o IP real vem em X-Forwarded-For.
// Só é usado com TRUST_PROXY=true; TRUST_PROXY_HOPS (padrão 1) diz quantos proxies confiáveis existem na frente:
// pegamos a entrada que o proxy mais próximo anexou, nunca a primeira (que o cliente pode forjar).

const IP_SHAPE = /^[0-9a-fA-F:.]{3,45}$/;

export function ipFromHeaders(headers: Headers): string {
  if (process.env.TRUST_PROXY === "true") {
    const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS ?? "1") || 1);
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
      const candidate = parts[Math.max(0, parts.length - hops)];
      if (candidate && IP_SHAPE.test(candidate)) return candidate;
    }
    const real = headers.get("x-real-ip")?.trim();
    if (real && IP_SHAPE.test(real)) return real;
  }
  return "desconhecido";
}
