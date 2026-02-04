-- Create produtos (commercial products) table
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  cod_imilk TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read produtos"
ON public.produtos
FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage produtos"
ON public.produtos
FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- Trigger for updated_at (using existing function)
CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add comment
COMMENT ON TABLE public.produtos IS 'Produtos comercializados pela Rumina (ex: RumiFlow, painéis, etc.)';