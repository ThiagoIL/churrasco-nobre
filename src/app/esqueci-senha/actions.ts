"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { email, parseForm, type FormState } from "@/lib/form";
import { hashToken, newToken } from "@/lib/crypto";
import { withinLimit } from "@/lib/rate-limit";
import { requestInfo } from "@/lib/request-info";
import { auditSafe } from "@/lib/audit";
import { appUrl, sendMail } from "@/lib/mail";
import { loadSettings } from "@/lib/access";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

const GENERIC = "Se o e-mail estiver cadastrado, você vai receber em instantes um link para criar uma nova senha. Ele vale por 1 hora.";

/**
 * Pede a recuperação de senha. A resposta é sempre a mesma (não revela se o e-mail existe) e há limite
 * de pedidos por IP e por e-mail. O token vai só no e-mail; no banco fica o SHA-256.
 */
export async function requestResetAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(z.object({ email: email() }), formData);
  if (parsed.state) return parsed.state;
  const address = parsed.data.email;
  const { ip } = await requestInfo();

  const allowed = (await withinLimit(`reset:ip:${ip}`, 8, 3600)) && (await withinLimit(`reset:email:${address}`, 3, 3600));
  if (!allowed) return { success: GENERIC };

  try {
    const settings = await loadSettings();
    const user = await db.user.findUnique({ where: { email: address } });
    if (user?.active && !settings.blocked) {
      const token = newToken();
      await db.$transaction([
        db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
        db.passwordReset.create({
          data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS), ip },
        }),
      ]);
      const link = `${appUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: user.email,
        subject: "Churrasco Nobre — redefinição de senha",
        text: `Olá, ${user.name}.\n\nRecebemos um pedido para criar uma nova senha no sistema do Churrasco Nobre.\nAbra o link abaixo (vale por 1 hora e só pode ser usado uma vez):\n\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
        html: `<p>Olá, ${escapeHtml(user.name)}.</p><p>Recebemos um pedido para criar uma nova senha no sistema do Churrasco Nobre. O link abaixo vale por 1 hora e só pode ser usado uma vez:</p><p><a href="${link}">Criar nova senha</a></p><p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
      });
      await auditSafe({ action: "auth.recuperacao_pedida", entity: "auth", userId: user.id, actor: address });
    }
  } catch (error) {
    console.error("[recuperacao-de-senha]", error);
  }
  return { success: GENERIC };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
