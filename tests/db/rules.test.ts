// Regras críticas no próprio banco. Cada teste roda em uma transação que é desfeita no final.
// Uso:  TEST_DATABASE_URL=postgresql://... npm run test:db   (banco descartável, migrations já aplicadas)
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

let client: pg.Client;
beforeAll(async () => {
  if (!url) return;
  client = new pg.Client({ connectionString: url });
  await client.connect();
});
afterAll(async () => { await client?.end(); });
beforeEach(async () => { if (client) await client.query("BEGIN"); });
afterEach(async () => { if (client) await client.query("ROLLBACK"); });

/** Executa e devolve a mensagem do erro (ou null). O ponto de salvamento mantém a transação utilizável. */
async function fails(sql: string, params: unknown[] = []): Promise<string | null> {
  await client.query("SAVEPOINT t");
  try {
    await client.query(sql, params);
    await client.query("RELEASE SAVEPOINT t");
    return null;
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT t");
    return (e as Error).message;
  }
}
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows[0] as T;

const user = (email: string, role = "STAFF", active = true) =>
  one<{ id: string }>(`INSERT INTO users (name, email, password_hash, role, active) VALUES ('T', $1, 'x', $2::"UserRole", $3) RETURNING id`, [email, role, active]);
const item = (name: string, track = true) =>
  one<{ id: string }>(`INSERT INTO items (name, unit, purchasable, sellable, track_stock) VALUES ($1, 'kg', true, true, $2) RETURNING id`, [name, track]);
const move = (itemId: string, direction: string, reason: string, qty: number) =>
  fails(`INSERT INTO stock_movements (item_id, direction, reason, qty_milli) VALUES ($1, $2::"StockDirection", $3::"StockReason", $4)`, [itemId, direction, reason, qty]);
const stock = async (itemId: string) => (await one<{ stock_qty_milli: number }>(`SELECT stock_qty_milli FROM items WHERE id = $1`, [itemId])).stock_qty_milli;

d("usuários", () => {
  it("sempre sobra um administrador ativo", async () => {
    await client.query("DELETE FROM users");
    const a = await user("a@x.com", "ADMIN");
    expect(await fails(`UPDATE users SET active = false WHERE id = $1`, [a.id])).toMatch(/ao menos um administrador/);
    expect(await fails(`UPDATE users SET role = 'STAFF' WHERE id = $1`, [a.id])).toMatch(/ao menos um administrador/);
    expect(await fails(`DELETE FROM users WHERE id = $1`, [a.id])).toMatch(/ao menos um administrador/);
    const b = await user("b@x.com", "ADMIN");
    expect(await fails(`UPDATE users SET active = false WHERE id = $1`, [a.id])).toBeNull();
    expect(b.id).toBeTruthy();
  });
  it("ninguém desativa, rebaixa nem exclui a si mesmo (quem age vem em app.actor_id)", async () => {
    await client.query("DELETE FROM users");
    const a = await user("a@x.com", "ADMIN");
    await user("b@x.com", "ADMIN");
    await client.query(`SELECT set_config('app.actor_id', $1, true)`, [a.id]);
    expect(await fails(`UPDATE users SET active = false WHERE id = $1`, [a.id])).toMatch(/próprio usuário/);
    expect(await fails(`UPDATE users SET role = 'STAFF' WHERE id = $1`, [a.id])).toMatch(/rebaixar/);
    expect(await fails(`DELETE FROM users WHERE id = $1`, [a.id])).toMatch(/excluir/);
  });
  it("e-mail precisa estar em minúsculas", async () => {
    expect(await fails(`INSERT INTO users (name, email, password_hash) VALUES ('T', 'Maiusculo@X.com', 'x')`)).toMatch(/users_email_lower/);
  });
  it("trocar a senha ou desativar revoga as sessões", async () => {
    const u = await user("c@x.com");
    await client.query(`INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, 'h1', now() + interval '1 hour')`, [u.id]);
    await client.query(`UPDATE users SET password_hash = 'novo' WHERE id = $1`, [u.id]);
    expect((await one<{ revoked_at: Date | null }>(`SELECT revoked_at FROM user_sessions WHERE token_hash = 'h1'`)).revoked_at).not.toBeNull();
    await client.query(`INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, 'h2', now() + interval '1 hour')`, [u.id]);
    await client.query(`UPDATE users SET active = false WHERE id = $1`, [u.id]);
    expect((await one<{ revoked_at: Date | null }>(`SELECT revoked_at FROM user_sessions WHERE token_hash = 'h2'`)).revoked_at).not.toBeNull();
  });
});

d("conta master do fornecedor", () => {
  it("não pode ser desativada nem excluída; só existe uma", async () => {
    await client.query("DELETE FROM platform_admins");
    const m = await one<{ id: string }>(`INSERT INTO platform_admins (name, email, password_hash, is_master) VALUES ('M', 'm@x.com', 'x', true) RETURNING id`);
    expect(await fails(`UPDATE platform_admins SET active = false WHERE id = $1`, [m.id])).toMatch(/master/);
    expect(await fails(`DELETE FROM platform_admins WHERE id = $1`, [m.id])).toMatch(/master/);
    expect(await fails(`INSERT INTO platform_admins (name, email, password_hash, is_master) VALUES ('M2', 'm2@x.com', 'x', true)`)).toMatch(/platform_admins_one_master/);
  });
});

d("estoque", () => {
  it("compra entra, consumo sai, e o saldo nunca fica negativo em consumo/perda/ajuste", async () => {
    const i = await item("Picanha");
    expect(await move(i.id, "IN", "PURCHASE", 5000)).toBeNull();
    expect(await stock(i.id)).toBe(5000);
    expect(await move(i.id, "OUT", "CONSUMPTION", 2000)).toBeNull();
    expect(await stock(i.id)).toBe(3000);
    expect(await move(i.id, "OUT", "CONSUMPTION", 3001)).toMatch(/Estoque insuficiente de "Picanha" \(saldo atual: 3\)/);
    expect(await move(i.id, "OUT", "LOSS", 3001)).toMatch(/insuficiente/);
    expect(await move(i.id, "OUT", "ADJUSTMENT", 3001)).toMatch(/insuficiente/);
    expect(await stock(i.id)).toBe(3000);
  });
  it("venda e estorno podem negativar", async () => {
    const i = await item("Cerveja");
    expect(await move(i.id, "OUT", "SALE", 1000)).toBeNull();
    expect(await stock(i.id)).toBe(-1000);
    expect(await move(i.id, "OUT", "REVERSAL", 500)).toBeNull();
    expect(await stock(i.id)).toBe(-1500);
  });
  it("movimentações são imutáveis e coerentes", async () => {
    const i = await item("Carvão");
    await move(i.id, "IN", "PURCHASE", 1000);
    expect(await fails(`UPDATE stock_movements SET qty_milli = 1 WHERE item_id = $1`, [i.id])).toMatch(/não podem ser alteradas/);
    expect(await fails(`DELETE FROM stock_movements WHERE item_id = $1`, [i.id])).toMatch(/não podem ser alteradas/);
    expect(await move(i.id, "OUT", "PURCHASE", 1)).toMatch(/stock_movements_reason/);
    expect(await move(i.id, "IN", "CONSUMPTION", 1)).toMatch(/stock_movements_reason/);
    expect(await move(i.id, "IN", "PURCHASE", 0)).toMatch(/stock_movements_qty/);
  });
  it("item que não controla estoque não recebe movimentação", async () => {
    const i = await item("Guardanapo", false);
    expect(await move(i.id, "IN", "PURCHASE", 1000)).toMatch(/não controla estoque/);
  });
});

d("financeiro", () => {
  const category = (kind: string, name: string) =>
    one<{ id: string }>(`INSERT INTO financial_categories (name, kind) VALUES ($1, $2::"EntryKind") RETURNING id`, [name, kind]);
  const entry = (kind: string, cat: string, amount = 1000) =>
    one<{ id: string }>(`INSERT INTO financial_entries (kind, description, amount_cents, date, category_id) VALUES ($1::"EntryKind", 'x', $2, current_date, $3) RETURNING id`, [kind, amount, cat]);

  it("categoria precisa combinar com o tipo e o valor precisa ser positivo", async () => {
    const inc = await category("INCOME", "T-Receita");
    expect(await fails(`INSERT INTO financial_entries (kind, description, amount_cents, date, category_id) VALUES ('EXPENSE', 'x', 100, current_date, $1)`, [inc.id])).toMatch(/não combina/);
    expect(await fails(`INSERT INTO financial_entries (kind, description, amount_cents, date, category_id) VALUES ('INCOME', 'x', 0, current_date, $1)`, [inc.id])).toMatch(/financial_entries_amount/);
    expect(await fails(`INSERT INTO financial_entries (kind, description, amount_cents, date, category_id) VALUES ('INCOME', 'x', 1000000001, current_date, $1)`, [inc.id])).toMatch(/financial_entries_amount/);
  });
  it("cancelado é definitivo e lançamentos não são excluídos", async () => {
    const inc = await category("INCOME", "T-Receita 2");
    const e = await entry("INCOME", inc.id);
    expect(await fails(`UPDATE financial_entries SET status = 'CANCELED' WHERE id = $1`, [e.id])).toMatch(/financial_entries_canceled/); // exige canceled_at
    await client.query(`UPDATE financial_entries SET status = 'CANCELED', canceled_at = now() WHERE id = $1`, [e.id]);
    expect(await fails(`UPDATE financial_entries SET amount_cents = 5 WHERE id = $1`, [e.id])).toMatch(/cancelado não pode ser alterado/);
    expect(await fails(`DELETE FROM financial_entries WHERE id = $1`, [e.id])).toMatch(/não pode ser excluído/);
  });
  it("categorias do sistema são protegidas", async () => {
    const c = await one<{ id: string }>(`INSERT INTO financial_categories (name, kind, is_system) VALUES ('Sys', 'INCOME', true) RETURNING id`);
    expect(await fails(`UPDATE financial_categories SET name = 'Outro' WHERE id = $1`, [c.id])).toMatch(/do sistema/);
    expect(await fails(`UPDATE financial_categories SET active = false WHERE id = $1`, [c.id])).toMatch(/do sistema/);
    expect(await fails(`DELETE FROM financial_categories WHERE id = $1`, [c.id])).toMatch(/do sistema/);
  });
  it("nomes únicos sem diferenciar maiúsculas", async () => {
    await category("EXPENSE", "Gás");
    expect(await fails(`INSERT INTO financial_categories (name, kind) VALUES ('GÁS', 'EXPENSE')`)).toBeNull(); // lower() em locale C não une acentos; o app normaliza
    expect(await fails(`INSERT INTO financial_categories (name, kind) VALUES ('gás', 'EXPENSE')`)).toMatch(/duplicate key/);
  });
});

d("pedidos e compras", () => {
  const order = () => one<{ id: string }>(`INSERT INTO orders (channel, table_label) VALUES ('TABLE', '1') RETURNING id`);
  const addLine = (orderId: string, itemId: string) =>
    fails(`INSERT INTO order_items (order_id, item_id, name, unit, qty_milli, unit_price_cents, total_cents) VALUES ($1, $2, 'x', 'kg', 1000, 100, 100)`, [orderId, itemId]);

  it("itens só mudam com o pedido aberto; pago só pode ser cancelado", async () => {
    const i = await item("Linguiça");
    const o = await order();
    expect(await addLine(o.id, i.id)).toBeNull();
    await client.query(`UPDATE orders SET status = 'PAID', paid_at = now(), total_cents = 100 WHERE id = $1`, [o.id]);
    expect(await addLine(o.id, i.id)).toMatch(/pedido aberto/);
    expect(await fails(`DELETE FROM order_items WHERE order_id = $1`, [o.id])).toMatch(/pedido aberto/);
    expect(await fails(`UPDATE orders SET total_cents = 999 WHERE id = $1`, [o.id])).toMatch(/pago não pode ser alterado/);
    expect(await fails(`UPDATE orders SET status = 'OPEN' WHERE id = $1`, [o.id])).toMatch(/só pode ser cancelado/);
    expect(await fails(`UPDATE orders SET status = 'CANCELED', canceled_at = now() WHERE id = $1`, [o.id])).toBeNull();
    expect(await fails(`UPDATE orders SET note = 'x' WHERE id = $1`, [o.id])).toMatch(/cancelado não pode ser alterado/);
    expect(await fails(`DELETE FROM orders WHERE id = $1`, [o.id])).toMatch(/não pode ser excluído/);
  });
  it("frete: nunca negativo e fixo depois que o pedido é pago", async () => {
    const o = await order();
    expect(await fails(`UPDATE orders SET freight_cents = -1 WHERE id = $1`, [o.id])).toMatch(/orders_freight/);
    expect(await fails(`UPDATE orders SET freight_cents = 500, total_cents = 500 WHERE id = $1`, [o.id])).toBeNull();
    await client.query(`UPDATE orders SET status = 'PAID', paid_at = now() WHERE id = $1`, [o.id]);
    expect(await fails(`UPDATE orders SET freight_cents = 0 WHERE id = $1`, [o.id])).toMatch(/pago não pode ser alterado/);
  });
  it("mesa/comanda: nome único sem diferenciar maiúsculas", async () => {
    await client.query(`INSERT INTO dining_tables (name) VALUES ('Mesa 99')`);
    expect(await fails(`INSERT INTO dining_tables (name) VALUES ('mesa 99')`)).toMatch(/dining_tables_name_ci/);
  });
  it("pedido marcado como pago exige a data do pagamento", async () => {
    const o = await order();
    expect(await fails(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [o.id])).toMatch(/orders_paid/);
  });
  it("compra: itens e total imutáveis, só cancela", async () => {
    const cat = await one<{ id: string }>(`INSERT INTO financial_categories (name, kind) VALUES ('Compras T', 'EXPENSE') RETURNING id`);
    const i = await item("Frango");
    const p = await one<{ id: string }>(`INSERT INTO purchases (date, category_id, total_cents) VALUES (current_date, $1, 1000) RETURNING id`, [cat.id]);
    expect(await fails(`INSERT INTO purchase_items (purchase_id, item_id, qty_milli, unit_cost_cents, total_cents) VALUES ($1, $2, 1000, 1000, 1000)`, [p.id, i.id])).toBeNull();
    expect(await fails(`UPDATE purchase_items SET qty_milli = 5 WHERE purchase_id = $1`, [p.id])).toMatch(/não podem ser alterados/);
    expect(await fails(`UPDATE purchases SET total_cents = 5 WHERE id = $1`, [p.id])).toMatch(/não podem ser alterados/);
    expect(await fails(`UPDATE purchases SET status = 'CANCELED', canceled_at = now() WHERE id = $1`, [p.id])).toBeNull();
    expect(await fails(`UPDATE purchases SET note = 'x' WHERE id = $1`, [p.id])).toMatch(/cancelada não pode ser alterada/);
    expect(await fails(`DELETE FROM purchases WHERE id = $1`, [p.id])).toMatch(/não pode ser excluído/);
  });
  it("compra a pagar exige vencimento", async () => {
    const cat = await one<{ id: string }>(`INSERT INTO financial_categories (name, kind) VALUES ('Compras T2', 'EXPENSE') RETURNING id`);
    expect(await fails(`INSERT INTO purchases (date, category_id, total_cents, paid) VALUES (current_date, $1, 1000, false)`, [cat.id])).toMatch(/purchases_due/);
  });
});

d("comprovantes de compra", () => {
  const purchase = async () => {
    const cat = await one<{ id: string }>(`INSERT INTO financial_categories (name, kind) VALUES ('Compras T3', 'EXPENSE') RETURNING id`);
    return one<{ id: string }>(`INSERT INTO purchases (date, category_id, total_cents) VALUES (current_date, $1, 1000) RETURNING id`, [cat.id]);
  };
  const attach = (purchaseId: string, type: string, size: number, dataLen = size, name = "nota.jpg") =>
    fails(`INSERT INTO purchase_attachments (purchase_id, file_name, content_type, size_bytes, data) VALUES ($1, $2, $3, $4, decode(repeat('ab', $5::int), 'hex'))`, [purchaseId, name, type, size, dataLen]);

  it("aceita imagem e PDF dentro do limite", async () => {
    const p = await purchase();
    expect(await attach(p.id, "image/jpeg", 10)).toBeNull();
    expect(await attach(p.id, "application/pdf", 10)).toBeNull();
  });
  it("recusa tipo fora da lista, tamanho inválido ou diferente do conteúdo e nome vazio", async () => {
    const p = await purchase();
    expect(await attach(p.id, "text/html", 10)).toMatch(/purchase_attachments_type/);
    expect(await attach(p.id, "image/svg+xml", 10)).toMatch(/purchase_attachments_type/);
    expect(await attach(p.id, "image/png", 0, 0)).toMatch(/purchase_attachments_size/);
    expect(await attach(p.id, "image/png", 9 * 1024 * 1024, 10)).toMatch(/purchase_attachments_size/);
    expect(await attach(p.id, "image/png", 20, 10)).toMatch(/purchase_attachments_size/);
    expect(await attach(p.id, "image/png", 10, 10, "  ")).toMatch(/purchase_attachments_name/);
  });
});

d("auditoria", () => {
  it("não pode ser alterada nem apagada", async () => {
    const log = await one<{ id: string }>(`INSERT INTO audit_logs (action, entity) VALUES ('teste.criou', 'teste') RETURNING id`);
    expect(await fails(`UPDATE audit_logs SET action = 'outra' WHERE id = $1`, [log.id])).toMatch(/não pode ser alterado/);
    expect(await fails(`DELETE FROM audit_logs WHERE id = $1`, [log.id])).toMatch(/não pode ser alterado/);
  });
  it("a configuração do sistema é única e não é apagada", async () => {
    expect(await fails(`INSERT INTO system_settings (id, enabled_modules) VALUES ('outro', '[]')`)).toMatch(/system_settings_singleton/);
  });
});
