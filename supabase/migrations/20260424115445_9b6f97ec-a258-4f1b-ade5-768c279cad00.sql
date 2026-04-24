
-- Permitir admin/coord. logística/coord. serviços excluírem qualquer pedido e seus filhos

CREATE POLICY "Admins and coords can delete any pedido"
ON public.pedidos FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador_logistica')
  OR has_role(auth.uid(), 'coordenador_servicos')
);

CREATE POLICY "Admins and coords can delete any pedido_itens"
ON public.pedido_itens FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador_logistica')
  OR has_role(auth.uid(), 'coordenador_servicos')
);

CREATE POLICY "Admins and coords can delete any pedido_item_assets"
ON public.pedido_item_assets FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador_logistica')
  OR has_role(auth.uid(), 'coordenador_servicos')
);

-- pedido_item_log: hoje não tem nenhuma policy de DELETE — criar uma cobrindo dono + roles
CREATE POLICY "Owner and managers can delete pedido_item_log"
ON public.pedido_item_log FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador_logistica')
  OR has_role(auth.uid(), 'coordenador_servicos')
  OR EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_item_log.pedido_id
      AND p.solicitante_id = auth.uid()
  )
);
