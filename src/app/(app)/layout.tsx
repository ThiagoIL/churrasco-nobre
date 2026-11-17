import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAccess } from "@/lib/auth";
import { loadSettings } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/labels";
import { logoutAction } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [access, settings] = await Promise.all([getAccess(), loadSettings()]);
  const { user, levels } = access;

  const footer = (
    <div className="space-y-2 text-sm">
      <Link href="/conta" className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-black/5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
          <UserRound className="size-4" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted">{ROLE_LABELS[user.role]} · Minha conta</span>
        </span>
      </Link>
      <form action={logoutAction}>
        <button type="submit" className="btn btn-outline w-full">
          <LogOut className="size-4" /> Sair
        </button>
      </form>
    </div>
  );

  return (
    <AppShell
      footer={footer}
      access={{ isAdmin: user.role === "ADMIN", levels }}
      userName={user.name}
      companyName={settings.companyName}
    >
      {children}
    </AppShell>
  );
}
