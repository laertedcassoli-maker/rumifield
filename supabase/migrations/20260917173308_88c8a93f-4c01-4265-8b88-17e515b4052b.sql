ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS motivo_relato text,
  ADD COLUMN IF NOT EXISTS quantidade_volumes integer;