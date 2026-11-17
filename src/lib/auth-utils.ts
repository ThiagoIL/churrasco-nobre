// Utilitários puros das telas de entrada e de "Minha conta".

/** Só aceita caminhos internos como destino após o login (nunca outro endereço). */
export function safeNext(value: string | undefined | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/^\/(login|esqueci-senha|redefinir-senha)(\/|$|\?)/.test(value)) return "/";
  return value;
}

/** Descrição curta do navegador e do aparelho ("Chrome em Android"), a partir do agente de usuário. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Aparelho desconhecido";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os =
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iPhone/iPad" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "Mac" :
    /Linux/.test(ua) ? "Linux" : "aparelho desconhecido";
  return `${browser} em ${os}`;
}
