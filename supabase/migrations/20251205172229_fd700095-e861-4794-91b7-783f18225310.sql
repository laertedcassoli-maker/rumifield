-- Tabela para registrar envios de produtos para clientes/fazendas
CREATE TABLE public.envios_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos_quimicos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  data_envio date NOT NULL DEFAULT CURRENT_DATE,
  registrado_por uuid REFERENCES auth.users(id),
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.envios_produtos ENABLE ROW LEVEL SECURITY;

-- Admin/Gestor can manage all shipments
CREATE POLICY "Admin/Gestor can manage all envios"
ON public.envios_produtos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Tecnico can view envios of assigned clients
CREATE POLICY "Tecnico can view envios of assigned clientes"
ON public.envios_produtos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tecnico_clientes
    WHERE tecnico_clientes.tecnico_id = auth.uid()
    AND tecnico_clientes.cliente_id = envios_produtos.cliente_id
  )
);