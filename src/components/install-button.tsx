"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

/** Botão "Instalar app": usa o aviso do navegador (Android/Chrome/Edge) ou orienta no iPhone. */
export function InstallButton() {
  const [available, setAvailable] = useState(false);
  const [ios, setIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const refresh = () => setAvailable(!!window.__nobreInstall);
    refresh();
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    window.addEventListener("nobre:install-available", refresh);
    return () => window.removeEventListener("nobre:install-available", refresh);
  }, []);

  async function install() {
    const event = window.__nobreInstall;
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    window.__nobreInstall = null;
    setAvailable(false);
  }

  if (available) {
    return (
      <button type="button" onClick={install} className="btn btn-gold w-full">
        <Download className="size-4" /> Instalar app
      </button>
    );
  }
  if (ios) {
    return (
      <div className="text-xs text-muted">
        <button type="button" onClick={() => setShowHelp((v) => !v)} className="btn btn-outline w-full">
          <Download className="size-4" /> Instalar no iPhone
        </button>
        {showHelp && (
          <p className="mt-2 leading-relaxed">
            Toque em <Share className="inline size-3.5" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
          </p>
        )}
      </div>
    );
  }
  return null;
}
