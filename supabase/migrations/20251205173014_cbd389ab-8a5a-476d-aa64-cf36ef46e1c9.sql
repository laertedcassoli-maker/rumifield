-- Tabela para log de alterações em envios
CREATE TABLE public.envios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id uuid NOT NULL REFERENCES public.envios_produtos(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id),
  campo_alterado text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.envios_log ENABLE ROW LEVEL SECURITY;

-- Admin can manage all logs
CREATE POLICY "Admin can manage envios_log"
ON public.envios_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));