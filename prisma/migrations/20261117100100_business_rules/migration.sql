-- Regras críticas no próprio banco: o sistema não confia só na aplicação.
-- Mensagens que começam com "[regra]" são mostradas ao usuário como estão.
-- A aplicação informa quem está agindo com set_config('app.actor_id', <id>, true) dentro da transação.

-- ───────────────────────── CHECKs ─────────────────────────

ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_singleton" CHECK ("id" = 'singleton');

ALTER TABLE "users"           ADD CONSTRAINT "users_email_lower"           CHECK ("email" = lower("email"));
ALTER TABLE "users"           ADD CONSTRAINT "users_failed_attempts_nonneg" CHECK ("failed_attempts" >= 0);
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_email_lower" CHECK ("email" = lower("email"));
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_failed_nonneg" CHECK ("failed_attempts" >= 0);

ALTER TABLE "user_sessions"     ADD CONSTRAINT "user_sessions_expiry"     CHECK ("expires_at" > "created_at");
ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_expiry" CHECK ("expires_at" > "created_at");

ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_amount"  CHECK ("amount_cents" > 0 AND "amount_cents" <= 1000000000),
  ADD CONSTRAINT "financial_entries_text"    CHECK (btrim("description") <> ''),
  ADD CONSTRAINT "financial_entries_source"  CHECK (("source" = 'PURCHASE') = ("purchase_id" IS NOT NULL) AND ("source" = 'ORDER') = ("order_id" IS NOT NULL)),
  ADD CONSTRAINT "financial_entries_canceled" CHECK (("status" = 'CANCELED') = ("canceled_at" IS NOT NULL));

ALTER TABLE "items"
  ADD CONSTRAINT "items_name"      CHECK (btrim("name") <> '' AND btrim("unit") <> ''),
  ADD CONSTRAINT "items_use"       CHECK ("purchasable" OR "sellable"),
  ADD CONSTRAINT "items_values"    CHECK ("cost_cents" >= 0 AND "price_cents" >= 0 AND "min_stock_milli" >= 0);

ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_total"    CHECK ("total_cents" > 0 AND "total_cents" <= 1000000000),
  ADD CONSTRAINT "purchases_due"      CHECK ("paid" OR "due_date" IS NOT NULL),
  ADD CONSTRAINT "purchases_canceled" CHECK (("status" = 'CANCELED') = ("canceled_at" IS NOT NULL));

ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_values" CHECK ("qty_milli" > 0 AND "unit_cost_cents" >= 0 AND "total_cents" >= 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_qty"    CHECK ("qty_milli" > 0),
  ADD CONSTRAINT "stock_movements_reason" CHECK (
    ("reason" = 'PURCHASE' AND "direction" = 'IN')
    OR ("reason" IN ('CONSUMPTION', 'LOSS', 'SALE') AND "direction" = 'OUT')
    OR "reason" IN ('ADJUSTMENT', 'REVERSAL')
  );

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_values"   CHECK ("discount_cents" >= 0 AND "total_cents" >= 0),
  ADD CONSTRAINT "orders_paid"     CHECK ("status" <> 'PAID' OR "paid_at" IS NOT NULL),
  ADD CONSTRAINT "orders_canceled" CHECK (("status" = 'CANCELED') = ("canceled_at" IS NOT NULL));

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_values" CHECK ("qty_milli" > 0 AND "unit_price_cents" >= 0 AND "total_cents" >= 0);

-- ───────────────────────── Unicidade sem diferenciar maiúsculas ─────────────────────────

CREATE UNIQUE INDEX "items_name_ci"                 ON "items" (lower("name"));
CREATE UNIQUE INDEX "items_code_ci"                 ON "items" (lower("code")) WHERE "code" IS NOT NULL;
CREATE UNIQUE INDEX "financial_categories_name_ci"  ON "financial_categories" ("kind", lower("name"));
CREATE UNIQUE INDEX "payment_methods_name_ci"       ON "payment_methods" (lower("name"));
CREATE UNIQUE INDEX "suppliers_name_ci"             ON "suppliers" (lower("name"));
CREATE UNIQUE INDEX "access_profiles_name_ci"       ON "access_profiles" (lower("name"));
-- só uma conta master do fornecedor
CREATE UNIQUE INDEX "platform_admins_one_master"    ON "platform_admins" ((true)) WHERE "is_master";

-- ───────────────────────── Usuários da empresa ─────────────────────────

CREATE FUNCTION "guard_users"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor  text := nullif(current_setting('app.actor_id', true), '');
  others int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF actor IS NOT NULL AND OLD.id::text = actor THEN
      RAISE EXCEPTION '[regra] Você não pode excluir o seu próprio usuário.';
    END IF;
    IF OLD.role = 'ADMIN' AND OLD.active THEN
      PERFORM 1 FROM users WHERE role = 'ADMIN' AND active AND id <> OLD.id FOR UPDATE;
      SELECT count(*) INTO others FROM users WHERE role = 'ADMIN' AND active AND id <> OLD.id;
      IF others = 0 THEN
        RAISE EXCEPTION '[regra] É preciso manter ao menos um administrador ativo.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF actor IS NOT NULL AND OLD.id::text = actor THEN
    IF OLD.active AND NOT NEW.active THEN
      RAISE EXCEPTION '[regra] Você não pode desativar o seu próprio usuário.';
    END IF;
    IF OLD.role = 'ADMIN' AND NEW.role <> 'ADMIN' THEN
      RAISE EXCEPTION '[regra] Você não pode rebaixar o seu próprio usuário.';
    END IF;
  END IF;

  IF OLD.role = 'ADMIN' AND OLD.active AND (NEW.role <> 'ADMIN' OR NOT NEW.active) THEN
    PERFORM 1 FROM users WHERE role = 'ADMIN' AND active AND id <> OLD.id FOR UPDATE;
    SELECT count(*) INTO others FROM users WHERE role = 'ADMIN' AND active AND id <> OLD.id;
    IF others = 0 THEN
      RAISE EXCEPTION '[regra] É preciso manter ao menos um administrador ativo.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "users_guard" BEFORE UPDATE OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "guard_users"();

-- Sessões são revogadas ao desativar o usuário ou trocar a senha.
CREATE FUNCTION "revoke_user_sessions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.active AND NOT NEW.active) OR NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    UPDATE user_sessions SET revoked_at = now() WHERE user_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "users_revoke_sessions" AFTER UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "revoke_user_sessions"();

-- ───────────────────────── Administradores do fornecedor ─────────────────────────

CREATE FUNCTION "guard_platform_admins"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor text := nullif(current_setting('app.actor_id', true), '');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_master THEN
      RAISE EXCEPTION '[regra] A conta master não pode ser excluída.';
    END IF;
    IF actor IS NOT NULL AND OLD.id::text = actor THEN
      RAISE EXCEPTION '[regra] Você não pode excluir a sua própria conta.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_master AND (NOT NEW.active OR NOT NEW.is_master) THEN
    RAISE EXCEPTION '[regra] A conta master não pode ser desativada nem perder o status de master.';
  END IF;
  IF NEW.is_master AND NOT OLD.is_master THEN
    RAISE EXCEPTION '[regra] A conta master só é definida na criação do sistema.';
  END IF;
  IF actor IS NOT NULL AND OLD.id::text = actor AND OLD.active AND NOT NEW.active THEN
    RAISE EXCEPTION '[regra] Você não pode desativar a sua própria conta.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "platform_admins_guard" BEFORE UPDATE OR DELETE ON "platform_admins"
  FOR EACH ROW EXECUTE FUNCTION "guard_platform_admins"();

CREATE FUNCTION "revoke_platform_sessions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.active AND NOT NEW.active) OR NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    UPDATE platform_sessions SET revoked_at = now() WHERE admin_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "platform_admins_revoke_sessions" AFTER UPDATE ON "platform_admins"
  FOR EACH ROW EXECUTE FUNCTION "revoke_platform_sessions"();

-- A configuração do sistema nunca é apagada.
CREATE FUNCTION "forbid_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '[regra] Este registro não pode ser excluído (%).', TG_TABLE_NAME;
END $$;

CREATE TRIGGER "system_settings_no_delete" BEFORE DELETE ON "system_settings"
  FOR EACH ROW EXECUTE FUNCTION "forbid_delete"();

-- ───────────────────────── Auditoria imutável ─────────────────────────

CREATE FUNCTION "audit_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- única alteração permitida: o vínculo com o usuário zerar quando o usuário for excluído (ON DELETE SET NULL)
  IF TG_OP = 'UPDATE' AND NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
     AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '[regra] O histórico de auditoria não pode ser alterado nem apagado.';
END $$;

CREATE TRIGGER "audit_logs_immutable" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_immutable"();

-- ───────────────────────── Estoque ─────────────────────────

-- Aplica a movimentação ao saldo do item (com bloqueio da linha) e impede saldo negativo
-- em consumo, perda e ajuste de saída. Vendas e estornos podem deixar o saldo negativo
-- (aparece como alerta) para nunca travar o caixa nem o cancelamento de uma compra.
CREATE FUNCTION "apply_stock_movement"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cur   int;
  nxt   int;
  nm    text;
  track boolean;
BEGIN
  SELECT stock_qty_milli, name, track_stock INTO cur, nm, track FROM items WHERE id = NEW.item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[regra] Item não encontrado.';
  END IF;
  IF NOT track THEN
    RAISE EXCEPTION '[regra] O item "%" não controla estoque.', nm;
  END IF;
  nxt := cur + CASE WHEN NEW.direction = 'IN' THEN NEW.qty_milli ELSE -NEW.qty_milli END;
  IF nxt < 0 AND NEW.direction = 'OUT' AND NEW.reason IN ('CONSUMPTION', 'LOSS', 'ADJUSTMENT') THEN
    RAISE EXCEPTION '[regra] Estoque insuficiente de "%" (saldo atual: %).', nm,
      replace(trim(trailing '.' FROM trim(trailing '0' FROM round(cur / 1000.0, 3)::text)), '.', ',');
  END IF;
  UPDATE items SET stock_qty_milli = nxt, updated_at = now() WHERE id = NEW.item_id;
  RETURN NEW;
END $$;

CREATE TRIGGER "stock_movements_apply" BEFORE INSERT ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION "apply_stock_movement"();

CREATE FUNCTION "stock_movements_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.created_by_id IS NULL AND OLD.created_by_id IS NOT NULL
     AND (to_jsonb(NEW) - 'created_by_id') = (to_jsonb(OLD) - 'created_by_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '[regra] Movimentações de estoque não podem ser alteradas; lance uma correção.';
END $$;

CREATE TRIGGER "stock_movements_no_change" BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION "stock_movements_immutable"();

-- ───────────────────────── Financeiro ─────────────────────────

CREATE FUNCTION "check_entry"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  k "EntryKind";
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'CANCELED' THEN
    RAISE EXCEPTION '[regra] Lançamento cancelado não pode ser alterado.';
  END IF;
  SELECT kind INTO k FROM financial_categories WHERE id = NEW.category_id;
  IF k IS DISTINCT FROM NEW.kind THEN
    RAISE EXCEPTION '[regra] A categoria escolhida não combina com o tipo do lançamento.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "financial_entries_check" BEFORE INSERT OR UPDATE ON "financial_entries"
  FOR EACH ROW EXECUTE FUNCTION "check_entry"();

CREATE TRIGGER "financial_entries_no_delete" BEFORE DELETE ON "financial_entries"
  FOR EACH ROW EXECUTE FUNCTION "forbid_delete"();

-- ───────────────────────── Compras ─────────────────────────

CREATE FUNCTION "check_purchase"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELED' THEN
    RAISE EXCEPTION '[regra] Compra cancelada não pode ser alterada.';
  END IF;
  IF NEW.total_cents <> OLD.total_cents OR NEW.date <> OLD.date THEN
    RAISE EXCEPTION '[regra] O total e a data de uma compra não podem ser alterados; cancele e lance de novo.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "purchases_check" BEFORE UPDATE ON "purchases"
  FOR EACH ROW EXECUTE FUNCTION "check_purchase"();

CREATE TRIGGER "purchases_no_delete" BEFORE DELETE ON "purchases"
  FOR EACH ROW EXECUTE FUNCTION "forbid_delete"();

CREATE FUNCTION "check_purchase_item"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  st "PurchaseStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION '[regra] Os itens de uma compra não podem ser alterados; cancele e lance de novo.';
  END IF;
  SELECT status INTO st FROM purchases WHERE id = NEW.purchase_id;
  IF st IS DISTINCT FROM 'RECEIVED' THEN
    RAISE EXCEPTION '[regra] Não é possível incluir itens em uma compra cancelada.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "purchase_items_check" BEFORE INSERT OR UPDATE OR DELETE ON "purchase_items"
  FOR EACH ROW EXECUTE FUNCTION "check_purchase_item"();

-- ───────────────────────── Pedidos ─────────────────────────

CREATE FUNCTION "check_order"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELED' THEN
    RAISE EXCEPTION '[regra] Pedido cancelado não pode ser alterado.';
  END IF;
  IF OLD.status = 'PAID' THEN
    IF NEW.status NOT IN ('PAID', 'CANCELED') THEN
      RAISE EXCEPTION '[regra] Pedido pago só pode ser cancelado.';
    END IF;
    IF NEW.status = 'PAID' AND (NEW.total_cents <> OLD.total_cents OR NEW.discount_cents <> OLD.discount_cents) THEN
      RAISE EXCEPTION '[regra] Pedido pago não pode ser alterado.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "orders_check" BEFORE UPDATE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "check_order"();

CREATE TRIGGER "orders_no_delete" BEFORE DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "forbid_delete"();

-- Itens só mudam enquanto o pedido está aberto.
CREATE FUNCTION "check_order_item"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  st "OrderStatus";
BEGIN
  SELECT status INTO st FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  IF st IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION '[regra] Só é possível alterar os itens de um pedido aberto.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER "order_items_check" BEFORE INSERT OR UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION "check_order_item"();
