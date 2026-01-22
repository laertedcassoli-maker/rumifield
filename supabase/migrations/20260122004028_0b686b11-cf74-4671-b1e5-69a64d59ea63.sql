-- Add field to track when motor was last replaced (meter hours at replacement time)
ALTER TABLE public.workshop_items 
ADD COLUMN motor_replaced_at_meter_hours NUMERIC NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.workshop_items.motor_replaced_at_meter_hours IS 'Horímetro no momento da última troca do motor. Usado para calcular horas desde a troca.';