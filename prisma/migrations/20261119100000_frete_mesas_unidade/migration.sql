-- Frete no delivery, cadastro de mesas/comandas e unidade única (un) para todos os itens.

-- ───────────────────────── frete ─────────────────────────
ALTER TABLE "orders" ADD COLUMN "freight_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD CONSTRAINT "orders_freight" CHECK ("freight_cents" >= 0);

-- Pedido pago também não muda o frete (o total já o inclui).
CREATE OR REPLACE FUNCTION "check_order"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELED' THEN
    RAISE EXCEPTION '[regra] Pedido cancelado não pode ser alterado.';
  END IF;
  IF OLD.status = 'PAID' THEN
    IF NEW.status NOT IN ('PAID', 'CANCELED') THEN
      RAISE EXCEPTION '[regra] Pedido pago só pode ser cancelado.';
    END IF;
    IF NEW.status = 'PAID' AND (NEW.total_cents <> OLD.total_cents OR NEW.discount_cents <> OLD.discount_cents OR NEW.freight_cents <> OLD.freight_cents) THEN
      RAISE EXCEPTION '[regra] Pedido pago não pode ser alterado.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ───────────────────────── mesas / comandas ─────────────────────────
CREATE TABLE "dining_tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dining_tables_name_key" ON "dining_tables"("name");
CREATE UNIQUE INDEX "dining_tables_name_ci" ON "dining_tables" (lower("name"));

-- ───────────────────────── unidade única ─────────────────────────
-- Todos os itens passam a ser contados em unidades.
UPDATE "items" SET "unit" = 'un' WHERE "unit" <> 'un';
