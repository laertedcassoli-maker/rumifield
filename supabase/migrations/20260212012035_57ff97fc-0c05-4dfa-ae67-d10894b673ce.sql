-- Allow admins and coordinators to update pedido_itens (e.g., set workshop_item_id)
CREATE POLICY "Admins and coordinators can update pedido_itens"
ON public.pedido_itens
FOR UPDATE
USING (is_admin_or_coordinator(auth.uid()));