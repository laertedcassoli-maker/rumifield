
-- Adicionar coluna product_code na tabela produtos
ALTER TABLE public.produtos ADD COLUMN product_code text;

-- Atualizar o registro existente do RumiFlow
UPDATE public.produtos SET product_code = 'rumiflow' WHERE nome = 'RumiFlow';

-- Criar indice unico para evitar duplicatas
CREATE UNIQUE INDEX idx_produtos_product_code ON public.produtos(product_code) WHERE product_code IS NOT NULL;
