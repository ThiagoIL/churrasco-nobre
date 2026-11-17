// Service worker do Churrasco Nobre.
// Guarda apenas o "casco" do app (página de sem-conexão, ícones e os arquivos estáticos versionados do Next).
// Nunca guarda páginas, respostas de API nem qualquer dado do sistema (dados financeiros e de clientes):
// navegações vão sempre à rede e, sem internet, mostram "/offline.html".
const VERSION = "nobre-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/logo-640.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  // Não ativa sozinho: a página mostra o aviso "nova versão" e pede a troca (mensagem SKIP_WAITING).
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // telas: sempre da rede; sem internet, a página de "sem conexão"
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // arquivos estáticos versionados do Next (JS/CSS/fontes com hash no nome): não contêm dados de ninguém
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
  // todo o resto (dados, ações do servidor, RSC) vai direto à rede, sem cache
});
