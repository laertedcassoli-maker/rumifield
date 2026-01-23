-- Add contract model field to clientes table
ALTER TABLE public.clientes 
ADD COLUMN modelo_contrato TEXT CHECK (modelo_contrato IN ('setup', 'comodato', 'venda'));