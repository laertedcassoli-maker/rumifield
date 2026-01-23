-- Add observation fields to preventive_maintenance
-- internal_notes: for Rumina team only (not shown in reports)
-- public_notes: for producer (shown in reports)

ALTER TABLE public.preventive_maintenance
ADD COLUMN internal_notes text,
ADD COLUMN public_notes text;