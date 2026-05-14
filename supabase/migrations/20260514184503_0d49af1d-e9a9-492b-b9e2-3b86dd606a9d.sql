-- Replace auto-link trigger with proportional reconciliation logic
CREATE OR REPLACE FUNCTION public.auto_link_pedido_pecas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido_id uuid;
  v_trigger_peca_id uuid;
  v_target_peca_id uuid;
  v_codigo_changed text;
  v_total_trigger numeric;
  v_target_qty numeric;
BEGIN
  -- Determine pedido_id from NEW or OLD
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  IF v_pedido_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve trigger and target part ids
  SELECT id INTO v_trigger_peca_id FROM public.pecas WHERE codigo = 'PRD00605' LIMIT 1;
  SELECT id INTO v_target_peca_id  FROM public.pecas WHERE codigo = 'PRD00639' LIMIT 1;

  IF v_trigger_peca_id IS NULL OR v_target_peca_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Identify which part the changed row referred to (NEW for INSERT/UPDATE, OLD for DELETE)
  SELECT codigo INTO v_codigo_changed
  FROM public.pecas
  WHERE id = COALESCE(NEW.peca_id, OLD.peca_id)
  LIMIT 1;

  -- Only react when the change involves the trigger part. Changes to the target part
  -- (driven by this very function) are ignored to prevent recursion.
  IF v_codigo_changed IS DISTINCT FROM 'PRD00605' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Sum trigger quantity in this pedido (only non-cancelled items)
  SELECT COALESCE(SUM(quantidade), 0)
    INTO v_total_trigger
  FROM public.pedido_itens
  WHERE pedido_id = v_pedido_id
    AND peca_id = v_trigger_peca_id
    AND cancelled_at IS NULL;

  v_target_qty := v_total_trigger * 3;

  IF v_target_qty > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.pedido_itens
      WHERE pedido_id = v_pedido_id AND peca_id = v_target_peca_id
    ) THEN
      UPDATE public.pedido_itens
        SET quantidade = v_target_qty,
            cancelled_at = NULL,
            cancelled_by = NULL
      WHERE pedido_id = v_pedido_id AND peca_id = v_target_peca_id;
    ELSE
      INSERT INTO public.pedido_itens (pedido_id, peca_id, quantidade)
      VALUES (v_pedido_id, v_target_peca_id, v_target_qty);
    END IF;
  ELSE
    DELETE FROM public.pedido_itens
    WHERE pedido_id = v_pedido_id AND peca_id = v_target_peca_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate trigger to fire on INSERT, UPDATE and DELETE
DROP TRIGGER IF EXISTS trg_auto_link_pedido_pecas ON public.pedido_itens;
CREATE TRIGGER trg_auto_link_pedido_pecas
AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_pedido_pecas();

-- One-shot reconciliation for existing pedidos containing PRD00605
DO $$
DECLARE
  r record;
  v_trigger_id uuid;
  v_target_id uuid;
  v_total numeric;
  v_target_qty numeric;
BEGIN
  SELECT id INTO v_trigger_id FROM public.pecas WHERE codigo = 'PRD00605' LIMIT 1;
  SELECT id INTO v_target_id  FROM public.pecas WHERE codigo = 'PRD00639' LIMIT 1;

  IF v_trigger_id IS NULL OR v_target_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT pedido_id
    FROM public.pedido_itens
    WHERE peca_id IN (v_trigger_id, v_target_id)
  LOOP
    SELECT COALESCE(SUM(quantidade), 0) INTO v_total
    FROM public.pedido_itens
    WHERE pedido_id = r.pedido_id
      AND peca_id = v_trigger_id
      AND cancelled_at IS NULL;

    v_target_qty := v_total * 3;

    IF v_target_qty > 0 THEN
      IF EXISTS (
        SELECT 1 FROM public.pedido_itens
        WHERE pedido_id = r.pedido_id AND peca_id = v_target_id
      ) THEN
        UPDATE public.pedido_itens
          SET quantidade = v_target_qty,
              cancelled_at = NULL,
              cancelled_by = NULL
        WHERE pedido_id = r.pedido_id AND peca_id = v_target_id;
      ELSE
        INSERT INTO public.pedido_itens (pedido_id, peca_id, quantidade)
        VALUES (r.pedido_id, v_target_id, v_target_qty);
      END IF;
    ELSE
      DELETE FROM public.pedido_itens
      WHERE pedido_id = r.pedido_id AND peca_id = v_target_id;
    END IF;
  END LOOP;
END $$;