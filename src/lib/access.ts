// Estado do sistema (bloqueio do fornecedor, vencimento, módulos liberados) e permissões do usuário.
// Sem "server-only" porque o proxy (runtime Node) também usa.
import { db } from "@/lib/db";
import { formatDate, todayString, dateOnlyToString } from "@/lib/dates";
import {
  DEFAULT_ENABLED_MODULES, levelFor, parseEnabledModules,
  type Access, type Level, type ModuleKey,
} from "@/lib/modules";
import type { SessionUser } from "@/lib/session-store";

export type SettingsSnapshot = {
  companyName: string;
  /** Bloqueado pelo fornecedor ou por vencimento. */
  blocked: boolean;
  blockMessage: string | null;
  /** Vencimento (YYYY-MM-DD) quando definido. */
  expiresOn: string | null;
  expired: boolean;
  enabled: ModuleKey[];
};

const TTL_MS = 3000;
let cache: { at: number; value: SettingsSnapshot } | null = null;

/**
 * Lê (com cache curto de 3 s) a configuração do sistema. Mudanças do fornecedor valem em poucos segundos;
 * o cache evita uma consulta a cada prefetch.
 */
export async function loadSettings(now = new Date()): Promise<SettingsSnapshot> {
  if (cache && now.getTime() - cache.at < TTL_MS) return cache.value;
  const s = await db.systemSettings.findUnique({ where: { id: "singleton" } });
  const expiresOn = s?.expiresOn ? dateOnlyToString(s.expiresOn) : null;
  const expired = !!expiresOn && todayString(now) > expiresOn;
  const manual = s?.blocked ?? false;
  const value: SettingsSnapshot = {
    companyName: s?.companyName ?? "Churrasco Nobre",
    blocked: manual || expired,
    blockMessage: manual
      ? (s?.blockMessage ?? null)
      : expired
        ? `O acesso venceu em ${formatDate(expiresOn)}. Fale com o fornecedor do sistema para regularizar.`
        : null,
    expiresOn,
    expired,
    enabled: s ? parseEnabledModules(s.enabledModules) : DEFAULT_ENABLED_MODULES,
  };
  cache = { at: now.getTime(), value };
  return value;
}

/** Descarta o cache (após o fornecedor alterar algo, nesta instância). */
export function clearSettingsCache() {
  cache = null;
}

export type AccessView = { user: SessionUser; enabled: ModuleKey[] };

export function levelOf(view: AccessView, module: ModuleKey): Level {
  if (!view.user.active) return "NONE";
  return levelFor({ role: view.user.role, permissions: view.user.permissions, enabled: view.enabled }, module);
}

/** Verifica se o usuário pode acessar `needed` (um módulo, com nível mínimo, ou "ADMIN"). */
export function hasAccess(view: AccessView, needed: Access, minimum: Level = "VIEW"): boolean {
  if (!view.user.active) return false;
  if (needed === "ADMIN") return view.user.role === "ADMIN";
  const level = levelOf(view, needed);
  return minimum === "VIEW" ? level !== "NONE" : level === "EDIT";
}
