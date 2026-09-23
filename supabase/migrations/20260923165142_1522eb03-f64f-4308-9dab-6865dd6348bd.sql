ALTER TABLE public.preventive_checklist_items ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.installation_checklist_items ADD COLUMN IF NOT EXISTS photo_path text;