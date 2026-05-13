ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS solenoide_modelo text NULL;
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_solenoide_modelo_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_solenoide_modelo_check CHECK (solenoide_modelo IS NULL OR solenoide_modelo IN ('2x','3x'));