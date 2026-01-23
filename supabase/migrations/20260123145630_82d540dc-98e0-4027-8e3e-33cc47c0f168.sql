-- Add checklist_template_id to preventive_routes
ALTER TABLE public.preventive_routes
ADD COLUMN checklist_template_id UUID REFERENCES public.checklist_templates(id);

-- Add comment explaining the field
COMMENT ON COLUMN public.preventive_routes.checklist_template_id IS 'Template de checklist a ser usado nas preventivas desta rota';