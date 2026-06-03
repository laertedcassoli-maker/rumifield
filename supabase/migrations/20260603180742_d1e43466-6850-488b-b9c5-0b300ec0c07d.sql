
ALTER TABLE public.ticket_tags ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'chamado' CHECK (scope IN ('chamado', 'oficina'));
UPDATE public.ticket_tags SET scope = 'chamado' WHERE scope IS NULL;

CREATE TABLE IF NOT EXISTS public.work_order_tag_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.ticket_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(work_order_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_tag_links TO authenticated;
GRANT ALL ON public.work_order_tag_links TO service_role;

ALTER TABLE public.work_order_tag_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage work_order_tag_links"
  ON public.work_order_tag_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
