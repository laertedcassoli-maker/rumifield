
-- Create table for opportunity interaction notes
CREATE TABLE public.crm_opportunity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id UUID NOT NULL REFERENCES public.crm_client_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by opportunity
CREATE INDEX idx_crm_opportunity_notes_client_product_id ON public.crm_opportunity_notes(client_product_id);

-- Enable RLS
ALTER TABLE public.crm_opportunity_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/coordinator OR client owner
CREATE POLICY "crm_opportunity_notes_select" ON public.crm_opportunity_notes
  FOR SELECT USING (
    is_admin_or_coordinator(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.crm_client_products cp
      WHERE cp.id = crm_opportunity_notes.client_product_id
        AND is_crm_client_owner(auth.uid(), cp.client_id)
    )
  );

-- INSERT: admin/coordinator OR client owner
CREATE POLICY "crm_opportunity_notes_insert" ON public.crm_opportunity_notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      is_admin_or_coordinator(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.crm_client_products cp
        WHERE cp.id = crm_opportunity_notes.client_product_id
          AND is_crm_client_owner(auth.uid(), cp.client_id)
      )
    )
  );

-- DELETE: admin/coordinator only
CREATE POLICY "crm_opportunity_notes_delete" ON public.crm_opportunity_notes
  FOR DELETE USING (is_admin_or_coordinator(auth.uid()));
