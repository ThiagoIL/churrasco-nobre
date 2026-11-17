import { NextResponse, type NextRequest } from "next/server";
import { hasAccess, loadSettings, type AccessView } from "@/lib/access";
import { PLATFORM_COOKIE, SESSION_COOKIE, cookieOptions } from "@/lib/cookies";
import { moduleForPath } from "@/lib/modules";
import { PLATFORM_BASE_HEADER, isPlatformHost, platformBasePath, stripPlatformBase } from "@/lib/platform-config";
import { loadPlatformSession, loadUserSession } from "@/lib/session-store";

/**
 * Porta de entrada de todas as requisições:
 *  - console do fornecedor, em um caminho do domínio (PLATFORM_ADMIN_PATH, padrão /sistema-admin)
 *    ou em um domínio dedicado (PLATFORM_ADMIN_HOSTS) → telas internas /platform/*, com login e sessão próprios;
 *  - o resto é o sistema da empresa: sessão, bloqueio do fornecedor, troca de senha obrigatória e
 *    permissão por módulo (GET aqui; as ações do servidor conferem o nível "Edita" por conta própria).
 * Também define a Content-Security-Policy com um nonce por requisição.
 */
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = await dispatch(request, headers);
  // a rota de download de comprovantes define a própria CSP (sandbox)
  if (!request.nextUrl.pathname.startsWith("/compras/anexo/")) response.headers.set("Content-Security-Policy", csp);
  return response;
}

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

async function dispatch(request: NextRequest, headers: Headers): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1) domínio dedicado ao console
  if (isPlatformHost(hostOf(request))) {
    const publicPath = pathname.startsWith("/platform") ? pathname.slice("/platform".length) || "/" : pathname;
    return handlePlatform(request, headers, "", publicPath);
  }

  // 2) caminho do console dentro do domínio do sistema
  const base = platformBasePath();
  const inner = stripPlatformBase(pathname, base);
  if (base && inner !== null) return handlePlatform(request, headers, base, inner);

  // o caminho interno do console não existe fora dele
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  return handleApp(request, headers);
}

// ───────────────────────── sistema da empresa ─────────────────────────

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha"];

async function handleApp(request: NextRequest, headers: Headers): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const readOnlyMethod = request.method === "GET" || request.method === "HEAD";
  const next = () => NextResponse.next({ request: { headers } });

  let settings;
  let session;
  try {
    settings = await loadSettings();
    session = await loadUserSession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (error) {
    console.error("[proxy] falha ao consultar o acesso:", error);
    return new NextResponse("Serviço indisponível", { status: 503 });
  }

  // Sistema bloqueado pelo fornecedor (ou vencido): tudo leva à tela de bloqueio.
  if (settings.blocked) {
    if (pathname === "/bloqueado" || !readOnlyMethod) return next();
    return NextResponse.redirect(new URL("/bloqueado", request.url));
  }
  if (pathname === "/bloqueado") return NextResponse.redirect(new URL("/", request.url));

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!session) {
    if (isPublic) return next();
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    const response = NextResponse.redirect(url);
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.set(SESSION_COOKIE, "", cookieOptions(0)); // expirada/revogada
    return response;
  }

  // já logado: as telas de entrada levam ao início
  if (isPublic) return NextResponse.redirect(new URL("/", request.url));

  // senha provisória: só a tela de troca de senha
  if (session.user.mustChangePassword) {
    if (pathname === "/trocar-senha" || !readOnlyMethod) return next();
    return NextResponse.redirect(new URL("/trocar-senha", request.url));
  }

  // permissão por módulo nas telas
  if (readOnlyMethod) {
    const needed = moduleForPath(pathname);
    const view: AccessView = { user: session.user, enabled: settings.enabled };
    if (needed && !hasAccess(view, needed)) {
      return NextResponse.redirect(new URL("/?acesso=negado", request.url));
    }
  }
  return next();
}

// ───────────────────────── console do fornecedor ─────────────────────────

/** `base` é o prefixo visível na URL ("" no domínio dedicado); `publicPath` é o caminho sem o prefixo. */
async function handlePlatform(request: NextRequest, headers: Headers, base: string, publicPath: string): Promise<NextResponse> {
  const { search } = request.nextUrl;
  const internal = `/platform${publicPath === "/" ? "" : publicPath}`;

  let session;
  try {
    session = await loadPlatformSession(request.cookies.get(PLATFORM_COOKIE)?.value);
  } catch (error) {
    console.error("[proxy] falha ao consultar a sessão do console:", error);
    return new NextResponse("Serviço indisponível", { status: 503 });
  }

  // as telas do console usam este header para montar links e redirecionamentos com o prefixo certo
  const forwarded = new Headers(headers);
  forwarded.set(PLATFORM_BASE_HEADER, base);
  const rewrite = () => NextResponse.rewrite(new URL(`${internal}${search}`, request.url), { request: { headers: forwarded } });

  if (publicPath === "/login") {
    return session ? NextResponse.redirect(new URL(base || "/", request.url)) : rewrite();
  }
  if (!session) {
    const response = NextResponse.redirect(new URL(`${base}/login`, request.url));
    if (request.cookies.has(PLATFORM_COOKIE)) response.cookies.set(PLATFORM_COOKIE, "", cookieOptions(0));
    return response;
  }
  return rewrite();
}

// ───────────────────────── utilitários ─────────────────────────

function hostOf(request: NextRequest): string {
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export const config = {
  // Arquivos estáticos (logo, ícones) precisam carregar na tela de login, antes da sessão.
  // Também liberam o app instalável: manifesto, service worker e a página de "sem conexão".
  matcher: [
    "/((?!_next/static|_next/image|api/health|manifest\\.webmanifest|sw\\.js|offline\\.html|.*\\.(?:jpg|jpeg|png|svg|ico|webp)$).*)",
  ],
};
