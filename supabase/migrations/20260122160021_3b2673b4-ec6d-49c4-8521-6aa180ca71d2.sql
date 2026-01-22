
-- Add current motor code to workshop_items
ALTER TABLE public.workshop_items 
ADD COLUMN current_motor_code text;

-- Add motor codes to motor_replacement_history
ALTER TABLE public.motor_replacement_history 
ADD COLUMN old_motor_code text,
ADD COLUMN new_motor_code text;

-- Add motor codes to work_order_parts_used (for motor parts)
ALTER TABLE public.work_order_parts_used 
ADD COLUMN motor_code_removed text,
ADD COLUMN motor_code_installed text;

-- Add comment for documentation
COMMENT ON COLUMN public.workshop_items.current_motor_code IS 'Código do motor atualmente instalado no ativo (formato DD-XXXXX)';
COMMENT ON COLUMN public.motor_replacement_history.old_motor_code IS 'Código do motor retirado na troca';
COMMENT ON COLUMN public.motor_replacement_history.new_motor_code IS 'Código do motor instalado na troca';
COMMENT ON COLUMN public.work_order_parts_used.motor_code_removed IS 'Código do motor retirado (quando peça é motor)';
COMMENT ON COLUMN public.work_order_parts_used.motor_code_installed IS 'Código do motor instalado (quando peça é motor)';
