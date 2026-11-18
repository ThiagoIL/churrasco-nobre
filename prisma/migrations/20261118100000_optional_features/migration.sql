-- Recursos opcionais ligados pelo console do fornecedor (ex.: cadastro de clientes). Começam desligados.
ALTER TABLE "system_settings" ADD COLUMN "enabled_features" JSONB NOT NULL DEFAULT '[]'::jsonb;
