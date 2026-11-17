import { Badge } from "@/components/ui/primitives";
import { ORDER_CHANNEL_LABELS, ORDER_STATUS_LABELS, PURCHASE_STATUS_LABELS, entryStatusLabel } from "@/lib/labels";
import { stockLevel } from "@/lib/rules/stock";

export function EntryStatusBadge({ kind, status, overdue }: { kind: "INCOME" | "EXPENSE"; status: "PAID" | "PENDING" | "CANCELED"; overdue?: boolean }) {
  if (status === "PENDING" && overdue) return <Badge tone="red">{entryStatusLabel(kind, status)} · vencido</Badge>;
  return <Badge tone={status === "PAID" ? "green" : status === "PENDING" ? "amber" : "gray"}>{entryStatusLabel(kind, status)}</Badge>;
}

export function KindBadge({ kind }: { kind: "INCOME" | "EXPENSE" }) {
  return <Badge tone={kind === "INCOME" ? "green" : "red"}>{kind === "INCOME" ? "Receita" : "Despesa"}</Badge>;
}

export function OrderStatusBadge({ status }: { status: "OPEN" | "PAID" | "CANCELED" }) {
  return <Badge tone={status === "OPEN" ? "amber" : status === "PAID" ? "green" : "gray"}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function ChannelBadge({ channel }: { channel: keyof typeof ORDER_CHANNEL_LABELS }) {
  return <Badge tone="gold">{ORDER_CHANNEL_LABELS[channel]}</Badge>;
}

export function PurchaseStatusBadge({ status, paid }: { status: "RECEIVED" | "CANCELED"; paid: boolean }) {
  if (status === "CANCELED") return <Badge tone="gray">{PURCHASE_STATUS_LABELS.CANCELED}</Badge>;
  return <Badge tone={paid ? "green" : "amber"}>{paid ? "Paga" : "A pagar"}</Badge>;
}

export function StockBadge({ balance, min, active = true }: { balance: number; min: number; active?: boolean }) {
  if (!active) return <Badge tone="gray">Inativo</Badge>;
  const level = stockLevel(balance, min);
  if (level === "negative") return <Badge tone="red">Negativo</Badge>;
  if (level === "zero") return <Badge tone="red">Zerado</Badge>;
  if (level === "low") return <Badge tone="amber">Baixo</Badge>;
  return <Badge tone="green">Ok</Badge>;
}
