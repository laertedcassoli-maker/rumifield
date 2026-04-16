CREATE POLICY "Admins and coordinators can insert pedido_itens"
ON public.pedido_itens
FOR INSERT
WITH CHECK (is_admin_or_coordinator(auth.uid()));