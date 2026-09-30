CREATE OR REPLACE FUNCTION public.can_cancel_installation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'instalacoes' AND rmp.can_delete
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_cancel_installation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cancel_installation(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Managers can update installations" ON public.installations;
CREATE POLICY "Managers can update installations" ON public.installations FOR UPDATE
  USING (public.can_manage_installations())
  WITH CHECK (public.can_manage_installations() AND (status IS DISTINCT FROM 'cancelado' OR public.can_cancel_installation(auth.uid())));

DROP POLICY IF EXISTS "Managers can update installation_stages" ON public.installation_stages;
CREATE POLICY "Managers can update installation_stages" ON public.installation_stages FOR UPDATE
  USING (public.can_manage_installations())
  WITH CHECK (public.can_manage_installations() AND (status IS DISTINCT FROM 'cancelado' OR stage = 'pre_instalacao' OR public.can_cancel_installation(auth.uid())));

DROP POLICY IF EXISTS "Managers can delete untouched installations" ON public.installations;
CREATE POLICY "Managers can delete untouched installations" ON public.installations FOR DELETE
  USING (public.can_cancel_installation(auth.uid()) AND NOT EXISTS (
    SELECT 1 FROM public.installation_stages s WHERE s.installation_id = installations.id AND s.status <> 'planejado'));

DROP POLICY IF EXISTS "Managers can delete installation_stages" ON public.installation_stages;
CREATE POLICY "Managers can delete installation_stages" ON public.installation_stages FOR DELETE
  USING (public.can_manage_installations() AND status = 'planejado' AND (stage = 'pre_instalacao' OR public.can_cancel_installation(auth.uid())));

DROP POLICY IF EXISTS "Technicians can update own installation_stages" ON public.installation_stages;
CREATE POLICY "Technicians can update own installation_stages" ON public.installation_stages FOR UPDATE
  USING ((technician_user_id = auth.uid()) OR (csm_user_id = auth.uid()))
  WITH CHECK (((technician_user_id = auth.uid()) OR (csm_user_id = auth.uid()))
    AND (status IS DISTINCT FROM 'cancelado' OR stage = 'pre_instalacao' OR public.can_cancel_installation(auth.uid())));