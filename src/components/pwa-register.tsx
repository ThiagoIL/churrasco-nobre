"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __nobreInstall?: InstallEvent | null;
  }
}

/**
 * Registra o service worker do app instalável (que só guarda o "casco": nunca dados do sistema),
 * guarda o evento de instalação para o botão "Instalar" e avisa quando há uma nova versão.
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__nobreInstall = event as InstallEvent;
      window.dispatchEvent(new Event("nobre:install-available"));
    };
    const onInstalled = () => {
      window.__nobreInstall = null;
      window.dispatchEvent(new Event("nobre:install-available"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
            });
          });
          // procura versão nova ao voltar para o app
          const check = () => document.visibilityState === "visible" && registration.update().catch(() => undefined);
          document.addEventListener("visibilitychange", check);
        })
        .catch(() => {
          // sem service worker o sistema funciona igual; só não mostra a tela de "sem conexão"
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-gold-300 bg-brand-900 px-4 py-3 text-sm text-white shadow-lg lg:bottom-6"
    >
      <RefreshCw className="size-4 shrink-0 text-gold-300" />
      <span className="flex-1">Há uma nova versão do sistema.</span>
      <button
        type="button"
        onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
        className="rounded-lg bg-gold-500 px-3 py-1.5 font-medium text-brand-950 hover:bg-gold-400"
      >
        Atualizar
      </button>
    </div>
  );
}
