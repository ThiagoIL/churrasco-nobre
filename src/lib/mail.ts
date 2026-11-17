import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

type Mail = { to: string; subject: string; text: string; html?: string };

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return (transporter = null);
  const port = Number(process.env.SMTP_PORT ?? "587");
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  return transporter;
}

/** Envia o e-mail por SMTP. Sem SMTP configurado, apenas registra no log do servidor (útil no desenvolvimento). */
export async function sendMail(mail: Mail): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mail] SMTP_HOST não configurado — e-mail para ${mail.to} NÃO enviado.\nAssunto: ${mail.subject}\n${mail.text}`);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || "Churrasco Nobre <nao-responder@localhost>",
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export function appUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
