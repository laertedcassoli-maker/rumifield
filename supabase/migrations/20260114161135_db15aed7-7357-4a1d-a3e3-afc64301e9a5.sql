-- Add stock quantity column to pecas table
ALTER TABLE public.pecas 
ADD COLUMN quantidade_estoque numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.pecas.quantidade_estoque IS 'Quantidade disponível em estoque, sincronizada do Omie';