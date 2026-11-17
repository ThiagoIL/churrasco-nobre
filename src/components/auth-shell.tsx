import type { ReactNode } from "react";

/** Moldura das telas de entrada (login, recuperação, bloqueio): a logo se funde com o fundo creme. */
export function AuthShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-sidebar px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <img src="/logo-640.jpg" alt="Churrasco Nobre" width={220} height={220} className="mb-2 size-44 sm:size-52" />
      <div className="card w-full max-w-md p-6 shadow-sm sm:p-8">
        {title && <h1 className="text-center text-2xl text-brand-700">{title}</h1>}
        {subtitle && <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>}
        <div className={title ? "mt-6" : ""}>{children}</div>
      </div>
      <p className="mt-6 text-xs text-muted">Churrasco Nobre · sistema de gestão</p>
    </main>
  );
}
