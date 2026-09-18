CREATE TABLE public.training_checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_visit_id uuid NOT NULL REFERENCES public.training_visits(id) ON DELETE CASCADE,
  checklist_template_item_id uuid NOT NULL REFERENCES public.checklist_template_items(id),
  checked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_checklist_responses TO authenticated;
GRANT ALL ON public.training_checklist_responses TO service_role;

ALTER TABLE public.training_checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read training checklist responses"
ON public.training_checklist_responses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can write training checklist responses"
ON public.training_checklist_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX idx_training_checklist_responses_unique
ON public.training_checklist_responses (training_visit_id, checklist_template_item_id);

CREATE TRIGGER update_training_checklist_responses_updated_at
BEFORE UPDATE ON public.training_checklist_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();