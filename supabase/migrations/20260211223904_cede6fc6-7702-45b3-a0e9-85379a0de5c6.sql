
-- Add asset_unique_code to preventive_part_consumption
ALTER TABLE public.preventive_part_consumption
ADD COLUMN asset_unique_code text;

-- Add preventive_id to pedidos for traceability
ALTER TABLE public.pedidos
ADD COLUMN preventive_id uuid REFERENCES public.preventive_maintenance(id);
