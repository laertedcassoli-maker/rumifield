CREATE TABLE public.pedido_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status public.pedido_status NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_pedido_status_history_pedido_changed
  ON public.pedido_status_history (pedido_id, changed_at);

GRANT SELECT ON public.pedido_status_history TO authenticated;
GRANT ALL ON public.pedido_status_history TO service_role;

ALTER TABLE public.pedido_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pedido status history"
  ON public.pedido_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.log_pedido_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pedido_status_history (pedido_id, status, changed_by)
  VALUES (NEW.id, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_pedido_status_insert
  AFTER INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.log_pedido_status_change();

CREATE TRIGGER trg_log_pedido_status_update
  AFTER UPDATE OF status ON public.pedidos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.log_pedido_status_change();