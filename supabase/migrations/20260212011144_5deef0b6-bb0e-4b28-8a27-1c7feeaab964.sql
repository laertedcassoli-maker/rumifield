-- Add workshop_item_id FK to pedido_itens for asset linking
ALTER TABLE public.pedido_itens
ADD COLUMN workshop_item_id uuid REFERENCES public.workshop_items(id) ON DELETE SET NULL;