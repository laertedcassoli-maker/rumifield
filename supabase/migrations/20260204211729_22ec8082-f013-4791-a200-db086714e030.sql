-- Create health indicators table for products
CREATE TABLE public.product_health_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_health_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read health indicators" 
ON public.product_health_indicators 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and coordinators can manage health indicators" 
ON public.product_health_indicators 
FOR ALL 
USING (is_admin_or_coordinator(auth.uid())) 
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_product_health_indicators_updated_at
BEFORE UPDATE ON public.product_health_indicators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add index for product lookup
CREATE INDEX idx_product_health_indicators_produto_id ON public.product_health_indicators(produto_id);

COMMENT ON TABLE public.product_health_indicators IS 'Indicadores de saúde do cliente para cada produto do CRM';