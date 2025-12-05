-- Corrigir política de Admin/Gestor para permitir gerenciar estoque (não apenas visualizar)
DROP POLICY IF EXISTS "Admin/Gestor can view all estoque" ON public.estoque_cliente;

CREATE POLICY "Admin/Gestor can manage all estoque" 
ON public.estoque_cliente 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));