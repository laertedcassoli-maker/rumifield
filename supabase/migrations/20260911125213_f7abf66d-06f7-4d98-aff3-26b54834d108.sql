ALTER TABLE public.work_order_parts_used
  ADD COLUMN IF NOT EXISTS motor_was_original boolean NOT NULL DEFAULT false;

ALTER TABLE public.motor_replacement_history
  ADD COLUMN IF NOT EXISTS was_original_motor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.work_order_parts_used.motor_was_original IS 'Marca que o motor retirado nesta OS era o motor original do ativo (nunca trocado antes).';
COMMENT ON COLUMN public.motor_replacement_history.was_original_motor IS 'Troca do motor original do ativo: permite considerar a vida útil dessa primeira troca nos dashboards.';