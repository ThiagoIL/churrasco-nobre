-- Comprovantes (foto/PDF da nota) das compras, guardados no banco.
CREATE TABLE "purchase_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_attachments_purchase_id_idx" ON "purchase_attachments"("purchase_id");

ALTER TABLE "purchase_attachments" ADD CONSTRAINT "purchase_attachments_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_attachments" ADD CONSTRAINT "purchase_attachments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras no banco: tamanho de até 8 MB, tipo permitido e nome preenchido.
ALTER TABLE "purchase_attachments"
  ADD CONSTRAINT "purchase_attachments_size" CHECK ("size_bytes" > 0 AND "size_bytes" <= 8388608 AND octet_length("data") = "size_bytes"),
  ADD CONSTRAINT "purchase_attachments_type" CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  ADD CONSTRAINT "purchase_attachments_name" CHECK (btrim("file_name") <> '');
