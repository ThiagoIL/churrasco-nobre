import { db } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { passwordError } from "@/lib/rules/password";
import { DEFAULT_ENABLED_MODULES } from "@/lib/modules";
import { SYSTEM_CATEGORIES } from "@/lib/system-categories";

const DEFAULT_CATEGORIES = [
  { name: "Outras receitas", kind: "INCOME" },
  { name: "Aluguel", kind: "EXPENSE" },
  { name: "Salários e encargos", kind: "EXPENSE" },
  { name: "Energia, água e gás", kind: "EXPENSE" },
  { name: "Impostos e taxas", kind: "EXPENSE" },
  { name: "Manutenção", kind: "EXPENSE" },
  { name: "Marketing", kind: "EXPENSE" },
  { name: "Outras despesas", kind: "EXPENSE" },
] as const;

const DEFAULT_PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito", "Vale-refeição", "Transferência"];

/**
 * Preparação idempotente executada ao iniciar o servidor (as migrations já rodaram no entrypoint):
 * configuração única do sistema, categorias do sistema, formas de pagamento padrão e as contas
 * iniciais (administrador da empresa e conta master do fornecedor) a partir das variáveis de ambiente.
 */
export async function bootstrap() {
  await db.systemSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", enabledModules: DEFAULT_ENABLED_MODULES },
  });

  // categorias do sistema (sempre existem)
  for (const c of Object.values(SYSTEM_CATEGORIES)) {
    const existing = await db.financialCategory.findFirst({ where: { kind: c.kind, name: { equals: c.name, mode: "insensitive" } } });
    if (!existing) await db.financialCategory.create({ data: { ...c, isSystem: true } });
    else if (!existing.isSystem || !existing.active) {
      await db.financialCategory.update({ where: { id: existing.id }, data: { isSystem: true, active: true } });
    }
  }
  if ((await db.financialCategory.count({ where: { isSystem: false } })) === 0) {
    await db.financialCategory.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c })), skipDuplicates: true });
  }
  if ((await db.paymentMethod.count()) === 0) {
    await db.paymentMethod.createMany({ data: DEFAULT_PAYMENT_METHODS.map((name) => ({ name })), skipDuplicates: true });
  }

  // administrador da empresa
  if ((await db.user.count()) === 0) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn("[bootstrap] nenhum usuário existe e ADMIN_EMAIL/ADMIN_PASSWORD não foram definidos");
    } else if (passwordError(password)) {
      console.error(`[bootstrap] ADMIN_PASSWORD não atende à política de senha: ${passwordError(password)}`);
    } else {
      await db.user.create({
        data: {
          name: process.env.ADMIN_NAME?.trim() || "Administrador",
          email,
          passwordHash: await hashPassword(password),
          role: "ADMIN",
          mustChangePassword: true,
        },
      });
      console.log(`[bootstrap] administrador criado: ${email} (troca de senha exigida no primeiro acesso)`);
    }
  }

  // conta master do fornecedor
  if ((await db.platformAdmin.count()) === 0) {
    const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.PLATFORM_ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn("[bootstrap] sem conta de fornecedor: defina PLATFORM_ADMIN_EMAIL e PLATFORM_ADMIN_PASSWORD");
    } else if (passwordError(password)) {
      console.error(`[bootstrap] PLATFORM_ADMIN_PASSWORD não atende à política de senha: ${passwordError(password)}`);
    } else {
      await db.platformAdmin.create({
        data: {
          name: process.env.PLATFORM_ADMIN_NAME?.trim() || "Fornecedor",
          email,
          passwordHash: await hashPassword(password),
          isMaster: true,
          mustChangePassword: true,
        },
      });
      console.log(`[bootstrap] conta master do fornecedor criada: ${email}`);
    }
  }
}
