ALTER TABLE public.corrective_maintenance DROP CONSTRAINT corrective_maintenance_status_check;
ALTER TABLE public.corrective_maintenance ADD CONSTRAINT corrective_maintenance_status_check CHECK (status = ANY (ARRAY['pendente','em_andamento','concluida','cancelada']));
ALTER TABLE public.installations ADD CONSTRAINT installations_status_check CHECK (status = ANY (ARRAY['planejado','em_andamento','aguardando_aprovacao','concluido','cancelado']));
ALTER TABLE public.installation_stages ADD CONSTRAINT installation_stages_status_check CHECK (status = ANY (ARRAY['planejado','em_andamento','aguardando_aprovacao','concluido','cancelado']));

ALTER TABLE public.work_orders ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.preventive_maintenance ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.preventive_route_items ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.preventive_routes ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.technical_tickets ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.ticket_visits ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.installation_stages ADD COLUMN arquivado boolean NOT NULL DEFAULT false;

-- work_orders
DROP POLICY "Admins can delete work_orders" ON public.work_orders;
CREATE POLICY "Admins can delete work_orders" ON public.work_orders FOR DELETE TO authenticated
  USING (is_admin_or_coordinator(auth.uid()) AND status = 'aguardando');

DROP POLICY "Users can delete work_order_items" ON public.work_order_items;
CREATE POLICY "Users can delete work_order_items" ON public.work_order_items FOR DELETE TO authenticated
  USING (is_admin_or_coordinator(auth.uid()) AND EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_items.work_order_id AND wo.status = 'aguardando'));

DROP POLICY "Users can delete parts_used" ON public.work_order_parts_used;
DROP POLICY "Users can delete work_order_parts_used" ON public.work_order_parts_used;
CREATE POLICY "Users can delete work_order_parts_used" ON public.work_order_parts_used FOR DELETE TO authenticated
  USING (is_admin_or_coordinator(auth.uid()) AND EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_parts_used.work_order_id AND wo.status = 'aguardando'));

-- pedidos
DROP POLICY "Admins and coords can delete any pedido" ON public.pedidos;
CREATE POLICY "Admins and coords can delete any pedido" ON public.pedidos FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador_logistica') OR has_role(auth.uid(),'coordenador_servicos')) AND status = 'rascunho');
DROP POLICY "Users can delete their own pedidos" ON public.pedidos;
CREATE POLICY "Users can delete their own pedidos" ON public.pedidos FOR DELETE
  USING (auth.uid() = solicitante_id AND status = 'rascunho');

DROP POLICY "Admins and coords can delete any pedido_itens" ON public.pedido_itens;
CREATE POLICY "Admins and coords can delete any pedido_itens" ON public.pedido_itens FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador_logistica') OR has_role(auth.uid(),'coordenador_servicos'))
    AND EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.status = 'rascunho'));
DROP POLICY "Users can delete pedido_itens of their pedidos" ON public.pedido_itens;
CREATE POLICY "Users can delete pedido_itens of their pedidos" ON public.pedido_itens FOR DELETE
  USING (EXISTS (SELECT 1 FROM pedidos WHERE pedidos.id = pedido_itens.pedido_id AND pedidos.solicitante_id = auth.uid() AND pedidos.status = 'rascunho'));

DROP POLICY "Owner and managers can delete pedido_item_log" ON public.pedido_item_log;
CREATE POLICY "Owner and managers can delete pedido_item_log" ON public.pedido_item_log FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador_logistica') OR has_role(auth.uid(),'coordenador_servicos')
      OR EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_item_log.pedido_id AND p.solicitante_id = auth.uid()))
    AND EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_item_log.pedido_id AND p.status = 'rascunho'));

-- preventivas
DROP POLICY "Admins and coordinators can delete preventive_route_items" ON public.preventive_route_items;
CREATE POLICY "Admins and coordinators can delete preventive_route_items" ON public.preventive_route_items FOR DELETE TO authenticated
  USING (is_admin_or_coordinator(auth.uid()) AND status IN ('planejado','reagendado'));
DROP POLICY "Admins and coordinators can delete preventive_routes" ON public.preventive_routes;
CREATE POLICY "Admins and coordinators can delete preventive_routes" ON public.preventive_routes FOR DELETE TO authenticated
  USING (is_admin_or_coordinator(auth.uid()) AND status = 'em_elaboracao');

-- technical_tickets (divide o ALL)
DROP POLICY "Admins and coordinators can manage technical_tickets" ON public.technical_tickets;
CREATE POLICY "Admins and coordinators can select technical_tickets" ON public.technical_tickets FOR SELECT USING (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admins and coordinators can insert technical_tickets" ON public.technical_tickets FOR INSERT WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admins and coordinators can update technical_tickets" ON public.technical_tickets FOR UPDATE USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admins and coordinators can delete technical_tickets" ON public.technical_tickets FOR DELETE USING (is_admin_or_coordinator(auth.uid()) AND status = 'aberto');

-- ticket_visits
DROP POLICY "Admins and coordinators can manage ticket_visits" ON public.ticket_visits;
CREATE POLICY "Admins and coordinators can select ticket_visits" ON public.ticket_visits FOR SELECT USING (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admins and coordinators can insert ticket_visits" ON public.ticket_visits FOR INSERT WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admins and coordinators can update ticket_visits" ON public.ticket_visits FOR UPDATE USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admins and coordinators can delete ticket_visits" ON public.ticket_visits FOR DELETE USING (is_admin_or_coordinator(auth.uid()) AND status IN ('em_elaboracao','planejada'));

-- installation_stages
DROP POLICY "Managers can manage installation_stages" ON public.installation_stages;
CREATE POLICY "Managers can select installation_stages" ON public.installation_stages FOR SELECT TO authenticated USING (can_manage_installations());
CREATE POLICY "Managers can insert installation_stages" ON public.installation_stages FOR INSERT TO authenticated WITH CHECK (can_manage_installations());
CREATE POLICY "Managers can update installation_stages" ON public.installation_stages FOR UPDATE TO authenticated USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Managers can delete installation_stages" ON public.installation_stages FOR DELETE TO authenticated USING (can_manage_installations() AND status = 'planejado');