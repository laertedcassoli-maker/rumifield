CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_visit_checklists 
  ON public.crm_visit_checklists(visit_id, checklist_template_id);