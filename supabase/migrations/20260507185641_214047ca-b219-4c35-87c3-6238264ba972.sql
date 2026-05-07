
CREATE OR REPLACE FUNCTION public.auto_link_pedido_pecas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_codigo text;
  v_target_id uuid;
BEGIN
  SELECT codigo INTO v_codigo FROM public.pecas WHERE id = NEW.peca_id;

  IF v_codigo = 'PRD00605' THEN
    SELECT id INTO v_target_id FROM public.pecas WHERE codigo = 'PRD00639' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.pedido_itens
        WHERE pedido_id = NEW.pedido_id AND peca_id = v_target_id
      ) THEN
        INSERT INTO public.pedido_itens (pedido_id, peca_id, quantidade)
        VALUES (NEW.pedido_id, v_target_id, 3);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_pedido_pecas ON public.pedido_itens;
CREATE TRIGGER trg_auto_link_pedido_pecas
AFTER INSERT ON public.pedido_itens
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_pedido_pecas();
