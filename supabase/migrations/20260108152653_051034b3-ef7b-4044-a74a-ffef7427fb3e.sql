-- Create table for system configurations
CREATE TABLE public.configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  valor text,
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Only admin can manage configurations
CREATE POLICY "Admin can manage configuracoes" 
ON public.configuracoes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_configuracoes_updated_at
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insert default Omie config entries
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('omie_app_key', '', 'APP KEY para API do Omie'),
  ('omie_app_secret', '', 'APP SECRET para API do Omie');