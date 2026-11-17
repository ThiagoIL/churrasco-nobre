// Regras de gestão de usuários. Repetidas em triggers no banco (migration business_rules).
export type Role = "ADMIN" | "STAFF";

export type UserChange =
  | { kind: "deactivate" }
  | { kind: "delete" }
  | { kind: "setRole"; role: Role };

export type TargetUser = { id: string; role: Role; active: boolean };

/**
 * Devolve a mensagem de bloqueio, ou null quando a alteração é permitida.
 * `otherActiveAdmins` = administradores ativos além do usuário-alvo.
 */
export function userChangeError(
  actorId: string,
  target: TargetUser,
  change: UserChange,
  otherActiveAdmins: number,
): string | null {
  const self = actorId === target.id;

  if (self) {
    if (change.kind === "delete") return "Você não pode excluir o seu próprio usuário.";
    if (change.kind === "deactivate" && target.active) return "Você não pode desativar o seu próprio usuário.";
    if (change.kind === "setRole" && target.role === "ADMIN" && change.role !== "ADMIN") {
      return "Você não pode rebaixar o seu próprio usuário.";
    }
  }

  const losesAdmin =
    target.role === "ADMIN" &&
    target.active &&
    (change.kind === "delete" || change.kind === "deactivate" || (change.kind === "setRole" && change.role !== "ADMIN"));
  if (losesAdmin && otherActiveAdmins === 0) return "É preciso manter ao menos um administrador ativo.";

  return null;
}

/** Conta master do fornecedor: protegida contra desativação, exclusão e perda do status. */
export function platformAdminChangeError(
  actorId: string,
  target: { id: string; isMaster: boolean; active: boolean },
  change: { kind: "deactivate" | "delete" },
): string | null {
  if (target.isMaster) {
    return change.kind === "delete"
      ? "A conta master não pode ser excluída."
      : "A conta master não pode ser desativada nem perder o status de master.";
  }
  if (actorId === target.id) {
    return change.kind === "delete" ? "Você não pode excluir a sua própria conta." : "Você não pode desativar a sua própria conta.";
  }
  return null;
}
