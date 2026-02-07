
CREATE TABLE public.crm_visit_product_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.crm_visits(id) ON DELETE CASCADE,
  client_product_id UUID NOT NULL REFERENCES public.crm_client_products(id) ON DELETE CASCADE,
  product_code public.product_code NOT NULL,
  stage public.crm_stage NOT NULL,
  value_estimated NUMERIC,
  probability INTEGER,
  loss_reason_id UUID REFERENCES public.crm_loss_reasons(id),
  loss_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_visit_product_snapshot ON public.crm_visit_product_snapshots(visit_id, client_product_id);

ALTER TABLE public.crm_visit_product_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and coordinators can manage all snapshots"
ON public.crm_visit_product_snapshots
FOR ALL
USING (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Consultors can manage snapshots for their visits"
ON public.crm_visit_product_snapshots
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.crm_visits v
    WHERE v.id = visit_id AND v.owner_user_id = auth.uid()
  )
);
