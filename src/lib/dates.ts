// Datas do restaurante. O Brasil (America/Sao_Paulo) não tem horário de verão desde 2019,
// então o deslocamento fixo de -03:00 é seguro e evita depender do TZ do servidor.
const OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Data de calendário "YYYY-MM-DD" -> Date UTC à meia-noite (colunas @db.Date). */
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date de coluna @db.Date -> "YYYY-MM-DD". */
export function dateOnlyToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Data/hora local -> instante (Date). */
export function zoned(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000-03:00`);
}

/** Instante -> { date: "YYYY-MM-DD", time: "HH:mm" } no horário local. */
export function localParts(instant: Date): { date: string; time: string } {
  const shifted = new Date(instant.getTime() - OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

export function todayString(now: Date = new Date()): string {
  return localParts(now).date;
}

/** Início (instante) de um dia local, para filtrar colunas timestamptz. */
export function startOfDayInstant(date: string): Date {
  return zoned(date, "00:00");
}

/** Início do dia seguinte ao informado (limite exclusivo), para filtrar timestamptz. */
export function endOfDayInstant(date: string): Date {
  return zoned(addDays(date, 1), "00:00");
}

export function addDays(date: string, days: number): string {
  const d = dateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000);
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/** Soma meses ao primeiro dia do mês de `date` ("YYYY-MM-01"). */
export function addMonthsToStart(date: string, months: number): string {
  const [y, m] = date.split("-").map(Number);
  const total = m - 1 + months;
  return `${y + Math.floor(total / 12)}-${pad((((total % 12) + 12) % 12) + 1)}-01`;
}

/** "2026-11-17" -> "17/11/2026" */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const s = typeof date === "string" ? date : dateOnlyToString(date);
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-11-17" -> "17/11" */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

/** Instante -> "17/11/2026 14:30" (horário local). */
export function formatDateTime(instant: Date | null | undefined): string {
  if (!instant) return "—";
  const { date, time } = localParts(instant);
  return `${formatDate(date)} ${time}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "2026-11" ou "2026-11-17" -> "novembro de 2026" */
export function monthLabel(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function weekdayLabel(date: string): string {
  return WEEKDAYS[dateOnly(date).getUTCDay()];
}
