CREATE OR REPLACE FUNCTION public.can_cancel_corretiva(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'chamados_listagem' AND rmp.can_delete
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_cancel_corretiva(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cancel_corretiva(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins and coordinators can update technical_tickets" ON public.technical_tickets;
CREATE POLICY "Admins and coordinators can update technical_tickets" ON public.technical_tickets FOR UPDATE
  USING (public.can_cancel_corretiva(auth.uid())) WITH CHECK (public.can_cancel_corretiva(auth.uid()));
DROP POLICY IF EXISTS "Admins and coordinators can update ticket_visits" ON public.ticket_visits;
CREATE POLICY "Admins and coordinators can update ticket_visits" ON public.ticket_visits FOR UPDATE
  USING (public.can_cancel_corretiva(auth.uid())) WITH CHECK (public.can_cancel_corretiva(auth.uid()));

DROP POLICY IF EXISTS "Assigned technicians can update their tickets" ON public.technical_tickets;
CREATE POLICY "Assigned technicians can update their tickets" ON public.technical_tickets FOR UPDATE
  USING (auth.uid() = assigned_technician_id)
  WITH CHECK (auth.uid() = assigned_technician_id AND (status IS DISTINCT FROM 'cancelado' OR public.can_cancel_corretiva(auth.uid())));
DROP POLICY IF EXISTS "Technicians can update their assigned visits" ON public.ticket_visits;
CREATE POLICY "Technicians can update their assigned visits" ON public.ticket_visits FOR UPDATE
  USING (auth.uid() = field_technician_user_id)
  WITH CHECK (auth.uid() = field_technician_user_id AND (status IS DISTINCT FROM 'cancelada' OR public.can_cancel_corretiva(auth.uid())));