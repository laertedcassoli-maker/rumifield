
-- Add stock_source column to track where the part came from
ALTER TABLE public.preventive_part_consumption 
ADD COLUMN stock_source text DEFAULT 'tecnico' CHECK (stock_source IN ('fazenda', 'tecnico'));

-- Add comment for documentation
COMMENT ON COLUMN public.preventive_part_consumption.stock_source IS 'Source of the part: fazenda (farm stock) or tecnico (technician stock)';
