import type { MetadataRoute } from "next";

/** Manifesto do app instalável (PWA): ícone na tela inicial e abertura em tela cheia. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Churrasco Nobre",
    short_name: "Nobre",
    description: "Sistema de gestão do Churrasco Nobre: financeiro, compras, estoque e pedidos",
    lang: "pt-BR",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f1e1d2", // creme da logo: a tela de abertura se funde com o ícone
    theme_color: "#8a1a14", // bordô da marca
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novo pedido", url: "/pedidos/novo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Nova despesa", url: "/financeiro/novo?tipo=despesa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Nova receita", url: "/financeiro/novo?tipo=receita", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
