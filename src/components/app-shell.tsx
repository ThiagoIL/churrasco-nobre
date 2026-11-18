"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  ArrowDownToLine, ArrowUpFromLine, ChefHat, ChevronRight, ClipboardList, Home, LayoutDashboard, Menu, Package,
  Plus, ReceiptText, ShieldCheck, ShoppingBasket, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import { ReadOnlyProvider } from "@/components/ui/form-kit";
import { MobileTables } from "@/components/mobile-tables";
import { InstallButton } from "@/components/install-button";
import { moduleForPath, type Access, type Level, type ModuleKey } from "@/lib/modules";

type NavItem = { href: string; label: string; access?: Access; /** recurso opcional que precisa estar ligado no console */ feature?: string };
type NavEntry =
  | { type: "link"; id: string; icon: LucideIcon; item: NavItem }
  | { type: "group"; id: string; title: string; icon: LucideIcon; items: NavItem[] };

const NAV: NavEntry[] = [
  { type: "link", id: "pedidos", icon: ChefHat, item: { href: "/pedidos", label: "Pedidos", access: "PEDIDOS" } },
  {
    type: "group", id: "financeiro", title: "Financeiro", icon: Wallet,
    items: [
      { href: "/financeiro", label: "Lançamentos", access: "FINANCEIRO" },
      { href: "/financeiro/fluxo", label: "Fluxo de caixa", access: "FINANCEIRO" },
    ],
  },
  { type: "link", id: "dashboard", icon: LayoutDashboard, item: { href: "/dashboard", label: "Dashboard", access: "DASHBOARD" } },
  { type: "link", id: "compras", icon: ShoppingBasket, item: { href: "/compras", label: "Compras", access: "COMPRAS" } },
  {
    type: "group", id: "estoque", title: "Estoque", icon: Package,
    items: [
      { href: "/estoque", label: "Saldo dos itens", access: "ESTOQUE" },
      { href: "/estoque/movimentacoes", label: "Movimentações", access: "ESTOQUE" },
      { href: "/estoque/saida", label: "Lançar consumo / perda", access: "ESTOQUE" },
    ],
  },
  {
    type: "group", id: "cadastros", title: "Cadastros", icon: ClipboardList,
    items: [
      { href: "/cadastros/itens", label: "Itens e valores", access: "CADASTROS" },
      { href: "/cadastros/categorias", label: "Categorias financeiras", access: "CADASTROS" },
      { href: "/cadastros/pagamentos", label: "Formas de pagamento", access: "CADASTROS" },
      { href: "/cadastros/mesas", label: "Mesas e comandas", access: "CADASTROS" },
      { href: "/cadastros/fornecedores", label: "Fornecedores", access: "CADASTROS", feature: "FORNECEDORES" },
      { href: "/cadastros/clientes", label: "Clientes", access: "CADASTROS", feature: "CLIENTES" },
    ],
  },
  {
    type: "group", id: "administracao", title: "Administração", icon: ShieldCheck,
    items: [
      { href: "/usuarios", label: "Usuários", access: "ADMIN" },
      { href: "/perfis", label: "Perfis de acesso", access: "ADMIN" },
      { href: "/auditoria", label: "Auditoria", access: "ADMIN" },
    ],
  },
];

type Shortcut = NavItem & { icon: LucideIcon; /** prefixo que deixa o atalho ativo (padrão: o próprio href) */ match?: string };

/** Atalhos da barra inferior do celular: os quatro primeiros que o usuário pode acessar; o resto fica em "Menu". */
const SHORTCUTS: Shortcut[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pedidos", label: "Pedidos", icon: ChefHat, access: "PEDIDOS" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, access: "FINANCEIRO" },
  { href: "/compras", label: "Compras", icon: ShoppingBasket, access: "COMPRAS" },
  { href: "/estoque", label: "Estoque", icon: Package, access: "ESTOQUE" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, access: "DASHBOARD" },
];

type QuickAction = { href: string; label: string; icon: LucideIcon; module: ModuleKey };
const QUICK_ACTIONS: QuickAction[] = [
  { href: "/pedidos/novo", label: "Novo pedido", icon: ChefHat, module: "PEDIDOS" },
  { href: "/financeiro/novo?tipo=receita", label: "Nova receita", icon: ArrowDownToLine, module: "FINANCEIRO" },
  { href: "/financeiro/novo?tipo=despesa", label: "Nova despesa", icon: ArrowUpFromLine, module: "FINANCEIRO" },
  { href: "/compras/nova", label: "Nova compra", icon: ReceiptText, module: "COMPRAS" },
];

/** Níveis de acesso do usuário logado, usados para montar o menu e o modo "somente consulta". */
export type ShellAccess = { isAdmin: boolean; levels: Record<ModuleKey, Level> };

export function AppShell({
  children, footer, access, userName, companyName, features = [],
}: { children: ReactNode; footer: ReactNode; access: ShellAccess; userName: string; companyName: string; features?: string[] }) {
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState(false);
  const pathname = usePathname();

  // fecha gavetas ao navegar
  useEffect(() => {
    setOpen(false);
    setQuick(false);
  }, [pathname]);

  const canSee = (item: NavItem) =>
    (!item.feature || features.includes(item.feature)) &&
    (!item.access || (item.access === "ADMIN" ? access.isAdmin : access.levels[item.access] !== "NONE"));

  // Perfil só de consulta no módulo da tela atual: formulários ficam desabilitados.
  const current = moduleForPath(pathname);
  const readOnly = !!current && current !== "ADMIN" && access.levels[current] === "VIEW";

  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  };
  // item de menu "exato": evita deixar "Lançamentos" ativo quando o usuário está em "Fluxo de caixa"
  const isActiveNav = (href: string, siblings: NavItem[]) => {
    if (!isActive(href)) return false;
    return !siblings.some((s) => s.href !== href && s.href.startsWith(`${href}/`) && isActive(s.href));
  };

  const entries = NAV.map((e) =>
    e.type === "link" ? (canSee(e.item) ? e : null) : { ...e, items: e.items.filter(canSee) },
  ).filter((e): e is NavEntry => !!e && (e.type === "link" || e.items.length > 0));

  const shortcuts = SHORTCUTS.filter(canSee).slice(0, 4);
  const quickActions = QUICK_ACTIONS.filter((a) => access.levels[a.module] === "EDIT");
  const hideFab = /\/(novo|nova|editar|saida)(\/|$)/.test(pathname) || /^\/pedidos\/[^/]+/.test(pathname) && !pathname.startsWith("/pedidos/novo");

  // Categorias abertas: a da tela atual abre sozinha; as demais o usuário abre e fecha.
  const activeGroup = entries.find((e) => e.type === "group" && e.items.some((i) => isActive(i.href)))?.id;
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    if (activeGroup) setOpenGroups((cur) => (cur.includes(activeGroup) ? cur : [...cur, activeGroup]));
  }, [activeGroup]);
  const toggle = (id: string) => setOpenGroups((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));

  const linkClass = (active: boolean) =>
    clsx(
      "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
      active
        ? "bg-white font-medium text-brand-700 shadow-xs ring-1 ring-black/5"
        : "text-ink/80 hover:bg-black/5 hover:text-ink",
    );

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
      <Link href="/" className={linkClass(isActive("/"))}>
        <Home className={clsx("size-4 shrink-0", isActive("/") && "text-gold-600")} />
        Início
      </Link>

      {entries.map((entry) => {
        const Icon = entry.icon;
        if (entry.type === "link") {
          const active = isActive(entry.item.href);
          return (
            <Link key={entry.id} href={entry.item.href} className={linkClass(active)}>
              <Icon className={clsx("size-4 shrink-0", active && "text-gold-600")} />
              {entry.item.label}
            </Link>
          );
        }
        const expanded = openGroups.includes(entry.id);
        const hasActive = entry.id === activeGroup;
        return (
          <div key={entry.id}>
            <button
              type="button"
              onClick={() => toggle(entry.id)}
              aria-expanded={expanded}
              className={clsx(
                "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/5",
                hasActive ? "font-medium text-ink" : "text-ink/80",
              )}
            >
              <Icon className={clsx("size-4 shrink-0", hasActive && "text-gold-600")} />
              <span className="flex-1">{entry.title}</span>
              <ChevronRight className={clsx("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-90")} />
            </button>
            {expanded && (
              <ul className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-gold-300/60 pl-3">
                {entry.items.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={clsx(
                        "block min-h-9 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActiveNav(href, entry.items)
                          ? "bg-white font-medium text-brand-700 shadow-xs ring-1 ring-black/5"
                          : "text-ink/70 hover:bg-black/5 hover:text-ink",
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-ink">
      <Link href="/" className="flex flex-col items-center border-b border-gold-300/50 px-4 pb-3 pt-4" aria-label={`${companyName} — início`}>
        {/* a logo tem o mesmo creme do fundo da barra lateral e se funde com ela */}
        <img src="/logo-640.jpg" alt={companyName} width={168} height={168} className="size-40" />
      </Link>
      {nav}
      <div className="space-y-3 border-t border-gold-300/50 p-4">
        <InstallButton />
        {footer}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-gold-300/40 lg:block">{sidebar}</aside>

      {/* celular: identificação no topo; o menu abre pela gaveta do botão "Menu" */}
      <div className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-surface px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
        <img src="/mark.svg" alt="" width={28} height={28} className="size-7" />
        <span className="font-display text-lg font-semibold tracking-tight text-brand-700">{companyName}</span>
        <span className="ml-auto truncate text-xs text-muted">{userName.split(" ")[0]}</span>
      </div>

      {/* gaveta do menu (celular) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[19rem] max-w-[88vw] pt-[env(safe-area-inset-top)] shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-10 grid size-11 place-items-center rounded-lg text-muted hover:text-ink"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          {readOnly && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              Seu perfil tem acesso somente de <strong>consulta</strong> a este módulo: você pode ver as informações, mas não alterá-las.
            </p>
          )}
          <ReadOnlyProvider readOnly={readOnly}>{children}</ReadOnlyProvider>
        </div>
      </main>
      <MobileTables />

      {/* celular: botão "+" de lançamento rápido */}
      {quickActions.length > 0 && !hideFab && (
        <div className="lg:hidden">
          {quick && <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setQuick(false)} />}
          <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2">
            {quick &&
              quickActions.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="btn btn-primary btn-lg gap-2 rounded-full pl-4 pr-5 shadow-lg">
                  <Icon className="size-5" /> {label}
                </Link>
              ))}
            <button
              type="button"
              onClick={() => setQuick((v) => !v)}
              aria-expanded={quick}
              aria-label={quick ? "Fechar lançamento rápido" : "Lançamento rápido"}
              className="grid size-14 place-items-center rounded-full bg-gold-500 text-brand-950 shadow-lg ring-2 ring-white hover:bg-gold-400"
            >
              <Plus className={clsx("size-7 transition-transform", quick && "rotate-45")} />
            </button>
          </div>
        </div>
      )}

      {/* celular: atalhos fixos na parte de baixo, ao alcance do polegar */}
      <nav
        aria-label="Atalhos"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_6px_rgba(0,0,0,0.05)] lg:hidden"
      >
        <ul className="flex">
          {shortcuts.map(({ href, label, icon: Icon, match }) => {
            const active = !open && isActive(match ?? href);
            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.7rem] font-medium leading-tight",
                    active ? "text-brand-700" : "text-muted",
                  )}
                >
                  <Icon className={clsx("size-5", active && "text-gold-600")} />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className={clsx(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.7rem] font-medium leading-tight",
                open ? "text-brand-700" : "text-muted",
              )}
            >
              <Menu className="size-5" />
              Menu
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
