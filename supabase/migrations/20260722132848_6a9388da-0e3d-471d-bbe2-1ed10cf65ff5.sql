
-- 1) user_invites: remove blanket anon SELECT; create SECURITY DEFINER RPC to fetch by token
DROP POLICY IF EXISTS "Qualquer um pode ler convite por token" ON public.user_invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE (
  id uuid,
  email text,
  nome text,
  role app_role,
  cidade_base text,
  expires_at timestamptz,
  used_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, nome, role, cidade_base, expires_at, used_at
  FROM public.user_invites
  WHERE token = _token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- 2) corrective_maintenance: replace USING(true) with role/technician scoped
DROP POLICY IF EXISTS "Users can view corrective maintenance" ON public.corrective_maintenance;
DROP POLICY IF EXISTS "Users can insert corrective maintenance" ON public.corrective_maintenance;
DROP POLICY IF EXISTS "Users can update corrective maintenance" ON public.corrective_maintenance;

CREATE POLICY "Staff and assigned tech can view corrective maintenance"
ON public.corrective_maintenance
FOR SELECT TO authenticated
USING (
  public.is_admin_or_coordinator(auth.uid())
  OR public.has_role(auth.uid(), 'servicos')
  OR public.has_role(auth.uid(), 'tecnico_campo')
  OR EXISTS (
    SELECT 1 FROM public.ticket_visits tv
    WHERE tv.id = corrective_maintenance.visit_id
      AND tv.field_technician_user_id = auth.uid()
  )
);

CREATE POLICY "Staff and assigned tech can insert corrective maintenance"
ON public.corrective_maintenance
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_coordinator(auth.uid())
  OR public.has_role(auth.uid(), 'servicos')
  OR public.has_role(auth.uid(), 'tecnico_campo')
);

CREATE POLICY "Staff and assigned tech can update corrective maintenance"
ON public.corrective_maintenance
FOR UPDATE TO authenticated
USING (
  public.is_admin_or_coordinator(auth.uid())
  OR public.has_role(auth.uid(), 'servicos')
  OR EXISTS (
    SELECT 1 FROM public.ticket_visits tv
    WHERE tv.id = corrective_maintenance.visit_id
      AND tv.field_technician_user_id = auth.uid()
  )
);

-- 3) Preventive checklist child tables: policies were TO public but meant to be authenticated
-- Recreate SELECT + INSERT/DELETE policies to authenticated only (drop the "Public read" USING(true) ones)
DROP POLICY IF EXISTS "Public read for checklist blocks" ON public.preventive_checklist_blocks;
DROP POLICY IF EXISTS "Public read for checklist items" ON public.preventive_checklist_items;
DROP POLICY IF EXISTS "Public read for item actions" ON public.preventive_checklist_item_actions;
DROP POLICY IF EXISTS "Public read for item nonconformities" ON public.preventive_checklist_item_nonconformities;
DROP POLICY IF EXISTS "Public read for checklists" ON public.preventive_checklists;
DROP POLICY IF EXISTS "Public read for parts consumption" ON public.preventive_part_consumption;
DROP POLICY IF EXISTS "Public read for visit media" ON public.preventive_visit_media;
