import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Inter, Playfair_Display } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Churrasco Nobre", template: "%s · Churrasco Nobre" },
  description: "Sistema de gestão do Churrasco Nobre",
  robots: { index: false, follow: false },
  // app instalável: no iPhone abre em tela cheia, com o nome curto sob o ícone
  appleWebApp: { capable: true, title: "Nobre", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // usa a tela toda; o conteúdo respeita a área segura (notch e barra inferior)
  themeColor: "#8a1a14",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // todas as telas são dinâmicas: o nonce da Content-Security-Policy (definido no proxy) vale em cada requisição
  await connection();
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
