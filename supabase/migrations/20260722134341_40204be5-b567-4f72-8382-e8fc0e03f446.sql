
-- Helper: is this ticket_visit exposed via a public corrective report token?
CREATE OR REPLACE FUNCTION public.is_public_corrective_visit(_visit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corrective_maintenance cm
    WHERE cm.visit_id = _visit_id AND cm.public_token IS NOT NULL
  )
$$;

-- Helper: is the user the assigned field technician of the ticket_visit tied to this corrective_maintenance?
CREATE OR REPLACE FUNCTION public.is_corrective_visit_technician(_user_id uuid, _visit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ticket_visits tv
    WHERE tv.id = _visit_id AND tv.field_technician_user_id = _user_id
  )
$$;

-- Rewrite ticket_visits public read policy without touching corrective_maintenance directly
DROP POLICY IF EXISTS "Public read ticket visits via corrective report" ON public.ticket_visits;
CREATE POLICY "Public read ticket visits via corrective report"
  ON public.ticket_visits
  FOR SELECT
  USING (public.is_public_corrective_visit(id));

-- Rewrite corrective_maintenance policies to use the helper (no direct ticket_visits subquery)
DROP POLICY IF EXISTS "Staff and assigned tech can view corrective maintenance" ON public.corrective_maintenance;
CREATE POLICY "Staff and assigned tech can view corrective maintenance"
  ON public.corrective_maintenance
  FOR SELECT
  USING (
    is_admin_or_coordinator(auth.uid())
    OR has_role(auth.uid(), 'servicos')
    OR has_role(auth.uid(), 'tecnico_campo')
    OR public.is_corrective_visit_technician(auth.uid(), visit_id)
  );

DROP POLICY IF EXISTS "Staff and assigned tech can update corrective maintenance" ON public.corrective_maintenance;
CREATE POLICY "Staff and assigned tech can update corrective maintenance"
  ON public.corrective_maintenance
  FOR UPDATE
  USING (
    is_admin_or_coordinator(auth.uid())
    OR has_role(auth.uid(), 'servicos')
    OR public.is_corrective_visit_technician(auth.uid(), visit_id)
  );
