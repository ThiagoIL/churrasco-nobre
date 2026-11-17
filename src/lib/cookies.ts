// Nomes e atributos dos cookies de sessão. Em produção usa o prefixo __Host- (Secure, Path=/, sem Domain).
// Sem dependências de servidor: usado também pelo proxy.

const prod = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = prod ? "__Host-nobre_session" : "nobre_session";
export const PLATFORM_COOKIE = prod ? "__Host-nobre_platform" : "nobre_platform";

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: prod,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
