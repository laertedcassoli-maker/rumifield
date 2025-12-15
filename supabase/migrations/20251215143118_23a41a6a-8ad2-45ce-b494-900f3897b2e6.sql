-- Add consumption columns per milking frequency to produtos_quimicos
ALTER TABLE public.produtos_quimicos
ADD COLUMN litros_por_vaca_2x numeric DEFAULT 0,
ADD COLUMN litros_por_vaca_3x numeric DEFAULT 0;

-- Add milking frequency to clientes
ALTER TABLE public.clientes
ADD COLUMN ordenhas_dia integer DEFAULT 2;

-- Update existing products with the values provided
-- Note: This will need to be run after knowing which product is which
COMMENT ON COLUMN public.produtos_quimicos.litros_por_vaca_2x IS 'Consumption per cow per month for 2 milkings/day';
COMMENT ON COLUMN public.produtos_quimicos.litros_por_vaca_3x IS 'Consumption per cow per month for 3 milkings/day';