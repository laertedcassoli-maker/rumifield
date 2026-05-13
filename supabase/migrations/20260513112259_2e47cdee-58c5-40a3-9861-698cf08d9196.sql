DROP POLICY IF EXISTS "Admins can manage ticket_tags" ON public.ticket_tags;

CREATE POLICY "Admins and coordinators can manage ticket_tags"
ON public.ticket_tags
FOR ALL
TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()))
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));