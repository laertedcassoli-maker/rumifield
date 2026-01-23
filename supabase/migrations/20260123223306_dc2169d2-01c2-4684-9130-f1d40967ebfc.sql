-- Add notes column to preventive_part_consumption for observations
ALTER TABLE public.preventive_part_consumption 
ADD COLUMN notes text;

-- Make exec_item_id and exec_nonconformity_id nullable for manual additions
ALTER TABLE public.preventive_part_consumption 
ALTER COLUMN exec_item_id DROP NOT NULL;

ALTER TABLE public.preventive_part_consumption 
ALTER COLUMN exec_nonconformity_id DROP NOT NULL;

-- Add a column to track if the part was added manually
ALTER TABLE public.preventive_part_consumption 
ADD COLUMN is_manual boolean DEFAULT false;

COMMENT ON COLUMN public.preventive_part_consumption.notes IS 'Observation/notes for this part consumption';
COMMENT ON COLUMN public.preventive_part_consumption.is_manual IS 'True if the part was added manually by the technician';