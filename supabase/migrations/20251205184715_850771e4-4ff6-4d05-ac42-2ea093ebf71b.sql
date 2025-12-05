-- Add RumiFlow activation date and status fields to clientes table
ALTER TABLE public.clientes 
ADD COLUMN data_ativacao_rumiflow date,
ADD COLUMN status text NOT NULL DEFAULT 'ativo';

-- Add comment for documentation
COMMENT ON COLUMN public.clientes.data_ativacao_rumiflow IS 'Data de ativação da fazenda no RumiFlow';
COMMENT ON COLUMN public.clientes.status IS 'Status da fazenda: ativo, inativo, suspenso';

-- Create index for status queries
CREATE INDEX idx_clientes_status ON public.clientes(status);
CREATE INDEX idx_clientes_data_ativacao ON public.clientes(data_ativacao_rumiflow);