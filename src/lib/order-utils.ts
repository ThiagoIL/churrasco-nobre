// Utilitários puros dos pedidos (título, tempo decorrido).
import { ORDER_CHANNEL_LABELS } from "@/lib/labels";

type OrderLike = {
  number: number;
  channel: keyof typeof ORDER_CHANNEL_LABELS;
  tableLabel: string | null;
  customerName: string | null;
};

/** "Mesa 4", "Maria", "Balcão"… — como o pedido é chamado no salão. */
export function orderWho(o: Pick<OrderLike, "channel" | "tableLabel" | "customerName">): string {
  if (o.channel === "TABLE" && o.tableLabel) return /^\d+$/.test(o.tableLabel) ? `Mesa ${o.tableLabel}` : o.tableLabel;
  if (o.customerName) return o.customerName;
  if (o.tableLabel) return o.tableLabel;
  return ORDER_CHANNEL_LABELS[o.channel];
}

export const orderTitle = (o: OrderLike) => `Pedido nº ${o.number} · ${orderWho(o)}`;

/** "agora", "há 12 min", "há 3 h", "há 2 dias". */
export function timeAgo(from: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
