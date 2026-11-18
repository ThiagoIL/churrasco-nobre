import "server-only";
import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/access";
import type { FeatureKey } from "@/lib/modules";

/** Recurso opcional ligado no console do fornecedor? */
export async function featureOn(key: FeatureKey): Promise<boolean> {
  return (await loadSettings()).features.includes(key);
}

/** Telas de um recurso desligado voltam ao início do módulo. */
export async function requireFeature(key: FeatureKey, backTo = "/cadastros") {
  if (!(await featureOn(key))) redirect(backTo);
}
