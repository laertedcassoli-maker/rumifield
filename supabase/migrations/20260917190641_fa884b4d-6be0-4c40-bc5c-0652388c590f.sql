ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS codigo_rastreio text, ADD COLUMN IF NOT EXISTS anexo_rastreio_path text;

CREATE POLICY "Responsaveis can update assigned pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (tecnico_responsavel_user_id = auth.uid() OR csm_responsavel_user_id = auth.uid());