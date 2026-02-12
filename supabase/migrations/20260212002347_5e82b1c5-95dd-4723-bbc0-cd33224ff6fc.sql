
-- Add tipo_logistica column to pedidos table
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_logistica text;

-- Migrate historical data
UPDATE public.pedidos SET tipo_logistica = 'correios' WHERE tipo_envio = 'correio';
UPDATE public.pedidos SET tipo_logistica = 'entrega_propria' WHERE tipo_envio = 'entrega';

-- Normalize old tipo_envio values to envio_fisico
UPDATE public.pedidos SET tipo_envio = 'envio_fisico' WHERE tipo_envio IN ('correio', 'entrega');
