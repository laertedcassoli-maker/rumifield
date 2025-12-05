-- Adicionar colunas de data de aferição e responsável
ALTER TABLE public.estoque_cliente 
ADD COLUMN data_afericao DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN responsavel TEXT NOT NULL DEFAULT 'Cliente' CHECK (responsavel IN ('Cliente', 'CSM'));