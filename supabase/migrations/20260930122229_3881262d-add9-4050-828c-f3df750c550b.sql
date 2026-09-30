CREATE OR REPLACE FUNCTION public.can_cancel_preventiva(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'minhas_rotas_listagem' AND rmp.can_delete
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_cancel_preventiva(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cancel_preventiva(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins and coordinators can update preventive_maintenance" ON public.preventive_maintenance;
CREATE POLICY "Admins and coordinators can update preventive_maintenance" ON public.preventive_maintenance FOR UPDATE TO authenticated USING (public.can_cancel_preventiva(auth.uid()));
DROP POLICY IF EXISTS "Admins and coordinators can update preventive_routes" ON public.preventive_routes;
CREATE POLICY "Admins and coordinators can update preventive_routes" ON public.preventive_routes FOR UPDATE TO authenticated USING (public.can_cancel_preventiva(auth.uid()));
DROP POLICY IF EXISTS "Admins and coordinators can update preventive_route_items" ON public.preventive_route_items;
CREATE POLICY "Admins and coordinators can update preventive_route_items" ON public.preventive_route_items FOR UPDATE TO authenticated USING (public.can_cancel_preventiva(auth.uid()));