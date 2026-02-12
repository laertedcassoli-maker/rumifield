-- Add asset_codes array column to pedido_itens
ALTER TABLE public.pedido_itens
ADD COLUMN asset_codes text[] DEFAULT '{}'::text[];

-- Add index for better query performance on asset-related searches
CREATE INDEX idx_pedido_itens_asset_codes ON public.pedido_itens USING GIN(asset_codes);