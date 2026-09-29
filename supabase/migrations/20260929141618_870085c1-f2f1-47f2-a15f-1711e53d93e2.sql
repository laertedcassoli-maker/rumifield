ALTER TABLE public.pedido_item_assets ALTER COLUMN workshop_item_id DROP NOT NULL;
ALTER TABLE public.pedido_item_assets ADD COLUMN IF NOT EXISTS dd_pistola_manual text;
ALTER TABLE public.pedido_item_assets ADD CONSTRAINT pedido_item_assets_lacre_ou_dd CHECK (workshop_item_id IS NOT NULL OR dd_pistola_manual IS NOT NULL);