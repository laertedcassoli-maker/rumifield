CREATE OR REPLACE FUNCTION public.can_cancel_work_order(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'oficina_os' AND rmp.can_delete = true
  )
$$;

DROP POLICY IF EXISTS "Admins can delete work_orders" ON public.work_orders;
CREATE POLICY "Admins can delete work_orders" ON public.work_orders FOR DELETE
USING (public.can_cancel_work_order(auth.uid()) AND status = 'aguardando'::work_order_status);

DROP POLICY IF EXISTS "Users can update assigned work_orders" ON public.work_orders;
CREATE POLICY "Users can update assigned work_orders" ON public.work_orders FOR UPDATE
USING ((auth.uid() = assigned_to_user_id) OR (auth.uid() = created_by_user_id) OR public.is_admin_or_coordinator(auth.uid()) OR public.has_role(auth.uid(), 'tecnico_oficina'::text))
WITH CHECK (
  ((auth.uid() = assigned_to_user_id) OR (auth.uid() = created_by_user_id) OR public.is_admin_or_coordinator(auth.uid()) OR public.has_role(auth.uid(), 'tecnico_oficina'::text))
  AND (status IS DISTINCT FROM 'cancelada'::work_order_status OR public.can_cancel_work_order(auth.uid()))
);