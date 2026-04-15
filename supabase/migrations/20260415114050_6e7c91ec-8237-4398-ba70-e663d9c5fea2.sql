
-- Junction table: multiple workshop_items per pedido_item
CREATE TABLE public.pedido_item_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_item_id uuid NOT NULL REFERENCES public.pedido_itens(id) ON DELETE CASCADE,
  workshop_item_id uuid NOT NULL REFERENCES public.workshop_items(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pedido_item_id, workshop_item_id)
);

ALTER TABLE public.pedido_item_assets ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Users can view pedido_item_assets"
  ON public.pedido_item_assets FOR SELECT
  TO authenticated
  USING (true);

-- Admins/coordinators full access
CREATE POLICY "Admins can manage pedido_item_assets"
  ON public.pedido_item_assets FOR ALL
  TO authenticated
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- Owner of the pedido can insert
CREATE POLICY "Owner can insert pedido_item_assets"
  ON public.pedido_item_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedido_itens pi
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE pi.id = pedido_item_assets.pedido_item_id
        AND p.solicitante_id = auth.uid()
    )
  );

-- Owner can delete
CREATE POLICY "Owner can delete pedido_item_assets"
  ON public.pedido_item_assets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedido_itens pi
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE pi.id = pedido_item_assets.pedido_item_id
        AND p.solicitante_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_pedido_item_assets_item ON public.pedido_item_assets(pedido_item_id);
