CREATE TABLE public.training_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_templates TO authenticated;
GRANT ALL ON public.training_templates TO service_role;

ALTER TABLE public.training_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_templates"
ON public.training_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and service coordinators can manage training_templates"
ON public.training_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_servicos'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_servicos'));

CREATE TRIGGER update_training_templates_updated_at
BEFORE UPDATE ON public.training_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.training_template_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.training_templates(id) ON DELETE CASCADE,
  block_name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_template_blocks TO authenticated;
GRANT ALL ON public.training_template_blocks TO service_role;

ALTER TABLE public.training_template_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_template_blocks"
ON public.training_template_blocks FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and service coordinators can manage training_template_blocks"
ON public.training_template_blocks FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_servicos'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_servicos'));

CREATE INDEX idx_training_template_blocks_template ON public.training_template_blocks(template_id, order_index);

CREATE TABLE public.training_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.training_template_blocks(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_template_items TO authenticated;
GRANT ALL ON public.training_template_items TO service_role;

ALTER TABLE public.training_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_template_items"
ON public.training_template_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and service coordinators can manage training_template_items"
ON public.training_template_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_servicos'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_servicos'));

CREATE INDEX idx_training_template_items_block ON public.training_template_items(block_id, order_index);