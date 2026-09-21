CREATE TABLE public.training_visit_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_visit_id uuid NOT NULL REFERENCES public.training_visits(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_visit_attendees TO authenticated;
GRANT ALL ON public.training_visit_attendees TO service_role;

ALTER TABLE public.training_visit_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read training visit attendees"
ON public.training_visit_attendees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can write training visit attendees"
ON public.training_visit_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_training_visit_attendees_visit ON public.training_visit_attendees (training_visit_id);