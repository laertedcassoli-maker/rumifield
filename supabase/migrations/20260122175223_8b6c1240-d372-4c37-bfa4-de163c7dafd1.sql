-- Fix CASCADE to RESTRICT for historical data protection

-- 1. Fix activity_products - should not lose configuration if part is deleted
ALTER TABLE public.activity_products DROP CONSTRAINT activity_products_omie_product_id_fkey;
ALTER TABLE public.activity_products 
  ADD CONSTRAINT activity_products_omie_product_id_fkey 
  FOREIGN KEY (omie_product_id) REFERENCES public.pecas(id) ON DELETE RESTRICT;

-- 2. Fix pedido_itens - should preserve order history
ALTER TABLE public.pedido_itens DROP CONSTRAINT pedido_itens_peca_id_fkey;
ALTER TABLE public.pedido_itens 
  ADD CONSTRAINT pedido_itens_peca_id_fkey 
  FOREIGN KEY (peca_id) REFERENCES public.pecas(id) ON DELETE RESTRICT;

-- 3. Fix clientes.tipo_pistola_id - should SET NULL instead of error
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_tipo_pistola_id_fkey;
ALTER TABLE public.clientes 
  ADD CONSTRAINT clientes_tipo_pistola_id_fkey 
  FOREIGN KEY (tipo_pistola_id) REFERENCES public.pecas(id) ON DELETE SET NULL;

-- 4. Create a function to check if a part can be deleted
CREATE OR REPLACE FUNCTION public.can_delete_peca(_peca_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_workshop_items boolean;
  has_work_order_items boolean;
  has_work_order_parts boolean;
  has_activity_products boolean;
  has_pedido_itens boolean;
BEGIN
  -- Check all tables that reference pecas
  SELECT EXISTS (SELECT 1 FROM workshop_items WHERE omie_product_id = _peca_id) INTO has_workshop_items;
  SELECT EXISTS (SELECT 1 FROM work_order_items WHERE omie_product_id = _peca_id) INTO has_work_order_items;
  SELECT EXISTS (SELECT 1 FROM work_order_parts_used WHERE omie_product_id = _peca_id) INTO has_work_order_parts;
  SELECT EXISTS (SELECT 1 FROM activity_products WHERE omie_product_id = _peca_id) INTO has_activity_products;
  SELECT EXISTS (SELECT 1 FROM pedido_itens WHERE peca_id = _peca_id) INTO has_pedido_itens;
  
  -- Part can be deleted only if it has no references
  RETURN NOT (has_workshop_items OR has_work_order_items OR has_work_order_parts OR has_activity_products OR has_pedido_itens);
END;
$$;

-- 5. Create a trigger to prevent deletion of referenced parts
CREATE OR REPLACE FUNCTION public.prevent_peca_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_delete_peca(OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir esta peça pois ela possui registros históricos. Marque-a como inativa.';
  END IF;
  RETURN OLD;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS prevent_peca_deletion_trigger ON public.pecas;
CREATE TRIGGER prevent_peca_deletion_trigger
  BEFORE DELETE ON public.pecas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_peca_deletion();

-- Add comment for documentation
COMMENT ON FUNCTION public.can_delete_peca IS 'Verifica se uma peça pode ser deletada (não possui referências históricas)';
COMMENT ON FUNCTION public.prevent_peca_deletion IS 'Trigger que impede exclusão de peças com histórico';