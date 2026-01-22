-- Tabela para Requisições de Garantia (lotes)
CREATE TABLE public.warranty_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'finalizada')),
  supplier_invoice text,
  notes text,
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  finalized_at timestamp with time zone
);

-- Adicionar coluna de referência para lote na tabela motor_replacement_history
ALTER TABLE public.motor_replacement_history
ADD COLUMN warranty_batch_id uuid REFERENCES public.warranty_batches(id);

-- Criar índice para buscas por lote
CREATE INDEX idx_motor_replacement_warranty_batch 
ON public.motor_replacement_history(warranty_batch_id);

-- Enable RLS
ALTER TABLE public.warranty_batches ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para warranty_batches
CREATE POLICY "Authenticated users can read warranty_batches"
ON public.warranty_batches FOR SELECT
USING (true);

CREATE POLICY "Users can create warranty_batches"
ON public.warranty_batches FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Admins can update warranty_batches"
ON public.warranty_batches FOR UPDATE
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins can delete warranty_batches"
ON public.warranty_batches FOR DELETE
USING (is_admin_or_coordinator(auth.uid()));

-- Função para gerar número sequencial da requisição
CREATE OR REPLACE FUNCTION public.generate_warranty_batch_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM 'RG-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.warranty_batches
  WHERE batch_number LIKE 'RG-' || year_part || '-%';
  
  new_number := 'RG-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$;