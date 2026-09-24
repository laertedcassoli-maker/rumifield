ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS codigo_rastreio_origem text,
  ADD COLUMN IF NOT EXISTS codigo_rastreio_atualizado_em timestamptz;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_codigo_rastreio_origem_check
  CHECK (codigo_rastreio_origem IS NULL OR codigo_rastreio_origem IN ('omie','relatorio_correios','manual'));