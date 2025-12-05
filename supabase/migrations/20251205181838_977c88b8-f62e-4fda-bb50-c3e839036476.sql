-- Adicionar consumo por vaca (L/vaca.mês) na tabela de produtos químicos (global)
ALTER TABLE public.produtos_quimicos 
ADD COLUMN litros_por_vaca_mes numeric DEFAULT 0;

-- Adicionar número de vacas em lactação na aferição
ALTER TABLE public.estoque_cliente 
ADD COLUMN vacas_lactacao integer DEFAULT NULL;