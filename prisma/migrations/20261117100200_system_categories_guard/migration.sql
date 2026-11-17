-- Categorias do sistema (Vendas, Compras de insumos) não podem ser renomeadas, trocar de tipo,
-- ser desativadas nem excluídas: as vendas e as compras dependem delas.
CREATE FUNCTION "guard_system_categories"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION '[regra] Categorias do sistema não podem ser excluídas.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system AND (NEW.name <> OLD.name OR NEW.kind <> OLD.kind OR NOT NEW.active OR NOT NEW.is_system) THEN
    RAISE EXCEPTION '[regra] Categorias do sistema não podem ser alteradas nem desativadas.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "financial_categories_guard" BEFORE UPDATE OR DELETE ON "financial_categories"
  FOR EACH ROW EXECUTE FUNCTION "guard_system_categories"();
