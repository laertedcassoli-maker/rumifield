DROP POLICY "Admins and coords can delete any pedido" ON public.pedidos;
CREATE POLICY "Admins and coords can delete any pedido" ON public.pedidos
  FOR DELETE TO authenticated
  USING (can_manage_pedidos(auth.uid()) AND status = 'rascunho'::pedido_status);

DROP POLICY "Admins and coords can delete any pedido_itens" ON public.pedido_itens;
CREATE POLICY "Admins and coords can delete any pedido_itens" ON public.pedido_itens
  FOR DELETE TO authenticated
  USING (can_manage_pedidos(auth.uid()) AND EXISTS (
    SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.status = 'rascunho'::pedido_status
  ));

DROP POLICY "Owner and managers can delete pedido_item_log" ON public.pedido_item_log;
CREATE POLICY "Owner and managers can delete pedido_item_log" ON public.pedido_item_log
  FOR DELETE TO authenticated
  USING (
    (can_manage_pedidos(auth.uid()) OR EXISTS (
      SELECT 1 FROM pedidos p WHERE p.id = pedido_item_log.pedido_id AND p.solicitante_id = auth.uid()
    ))
    AND EXISTS (
      SELECT 1 FROM pedidos p WHERE p.id = pedido_item_log.pedido_id AND p.status = 'rascunho'::pedido_status
    )
  );