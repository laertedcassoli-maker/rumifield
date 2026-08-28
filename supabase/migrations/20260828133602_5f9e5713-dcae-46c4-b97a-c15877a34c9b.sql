ALTER TABLE public.clientes
  ADD COLUMN estoque_interno boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clientes.estoque_interno IS
  'Marca clientes que representam estoque interno da Rumina (não são fazendas). Usado para relaxar validações operacionais, como código interno do motor.';