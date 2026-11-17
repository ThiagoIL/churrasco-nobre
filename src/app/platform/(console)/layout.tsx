import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getPlatformBase, requirePlatformAdmin } from "@/lib/platform-auth";
import { platformLogoutAction } from "@/app/platform/actions";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin({ allowPasswordChange: true });
  const base = await getPlatformBase();
  const links = [
    { href: base || "/", label: "Situação" },
    { href: `${base}/modulos`, label: "Módulos" },
    { href: `${base}/usuarios`, label: "Administradores" },
    { href: `${base}/eventos`, label: "Histórico" },
    { href: `${base}/conta`, label: "Minha conta" },
  ];
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-brand-900 bg-brand-800 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <img src="/mark.svg" alt="" width={28} height={28} className="size-7" />
          <span className="font-display text-lg font-semibold">Console do fornecedor</span>
          <nav className="flex flex-wrap gap-1 text-sm" aria-label="Console">
            {links.map((l) => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white">{l.label}</Link>)}
          </nav>
          <form action={platformLogoutAction} className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{admin.name}</span>
            <button type="submit" className="btn btn-sm bg-white/10 text-white hover:bg-white/20"><LogOut className="size-3.5" /> Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {admin.mustChangePassword && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">Você está com uma senha provisória: troque-a em <Link href={`${base}/conta`} className="font-medium underline">Minha conta</Link> para usar o console.</p>
        )}
        {children}
      </main>
    </div>
  );
}
