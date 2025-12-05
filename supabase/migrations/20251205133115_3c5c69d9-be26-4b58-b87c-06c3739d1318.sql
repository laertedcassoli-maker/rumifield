-- Adicionar campos para controle de galões
ALTER TABLE public.estoque_cliente 
ADD COLUMN IF NOT EXISTS galoes_cheios INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS nivel_galao_parcial INTEGER DEFAULT NULL;

-- Comentários explicativos
COMMENT ON COLUMN public.estoque_cliente.galoes_cheios IS 'Quantidade de galões de 50L cheios';
COMMENT ON COLUMN public.estoque_cliente.nivel_galao_parcial IS 'Nível do galão em uso: 0 (vazio), 25, 50 ou 75 (porcentagem). NULL se não há galão em uso';