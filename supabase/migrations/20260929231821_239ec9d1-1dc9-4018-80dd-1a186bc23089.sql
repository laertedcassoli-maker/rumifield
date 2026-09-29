CREATE OR REPLACE FUNCTION public.can_manage_pedidos(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role = ur.role
    WHERE ur.user_id = _user_id AND rmp.can_edit = true
      AND rmp.menu_key IN ('pedidos_envios','pedidos_coleta_reversa'))
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_pedidos(uuid) TO authenticated;
DROP POLICY IF EXISTS "Admins and coordinators can update pedidos" ON public.pedidos;
CREATE POLICY "Admins and coordinators can update pedidos" ON public.pedidos
  FOR UPDATE TO authenticated USING (public.can_manage_pedidos(auth.uid()));