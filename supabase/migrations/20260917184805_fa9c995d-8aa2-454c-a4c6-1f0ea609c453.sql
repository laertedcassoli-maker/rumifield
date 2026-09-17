ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'pendente';

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS codigo_postagem text,
  ADD COLUMN IF NOT EXISTS anexo_postagem_path text;