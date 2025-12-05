-- Remover constraint única para permitir múltiplas aferições por cliente/produto
ALTER TABLE public.estoque_cliente 
DROP CONSTRAINT IF EXISTS estoque_cliente_cliente_id_produto_id_key;