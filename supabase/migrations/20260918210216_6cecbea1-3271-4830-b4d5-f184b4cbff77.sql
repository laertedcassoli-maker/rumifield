DROP TABLE IF EXISTS public.training_template_items;
DROP TABLE IF EXISTS public.training_template_blocks;
DROP TABLE IF EXISTS public.training_templates;

CREATE TABLE public.training_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  checklist_template_id uuid REFERENCES public.checklist_templates(id),
  technician_user_id uuid REFERENCES auth.users(id),
  csm_user_id uuid REFERENCES auth.users(id),
  planned_date date,
  completed_date date,
  status text NOT NULL DEFAULT 'pendente',
  contact_name text,
  contact_phone text,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_visits TO authenticated;
GRANT ALL ON public.training_visits TO service_role;

ALTER TABLE public.training_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read training visits"
  ON public.training_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create training visits"
  ON public.training_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update training visits"
  ON public.training_visits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete training visits"
  ON public.training_visits FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_training_visits_cliente ON public.training_visits(cliente_id);
CREATE INDEX idx_training_visits_status ON public.training_visits(status);

CREATE TRIGGER update_training_visits_updated_at
  BEFORE UPDATE ON public.training_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();