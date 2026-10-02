CREATE OR REPLACE FUNCTION public.can_cancel_treinamento(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'treinamento' AND rmp.can_delete)
$$;
REVOKE EXECUTE ON FUNCTION public.can_cancel_treinamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cancel_treinamento(uuid) TO authenticated, service_role;

UPDATE public.role_menu_permissions SET can_delete = true
 WHERE menu_key = 'treinamento' AND role::text IN ('admin','coordenador_servicos');

DROP POLICY IF EXISTS "Authenticated can delete training visits" ON public.training_visits;
CREATE POLICY "Cancel managers can delete pending training visits" ON public.training_visits
FOR DELETE TO authenticated USING (
  public.can_cancel_treinamento(auth.uid()) AND status = 'pendente'
  AND NOT EXISTS (SELECT 1 FROM public.training_checklist_responses r WHERE r.training_visit_id = training_visits.id));

DROP POLICY IF EXISTS "Authenticated can update training visits" ON public.training_visits;
CREATE POLICY "Authenticated can update training visits" ON public.training_visits
FOR UPDATE TO authenticated USING (true)
WITH CHECK (status IS DISTINCT FROM 'cancelada' OR public.can_cancel_treinamento(auth.uid()));