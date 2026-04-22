
-- Permitir que usuários autenticados atualizem e insiram workshop_items.
-- Necessário para fluxos de oficina (conclusão de OS, registro de ativos)
-- executados por técnicos que não são admin/coordenador.

CREATE POLICY "Authenticated users can update workshop_items"
ON public.workshop_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can insert workshop_items"
ON public.workshop_items
FOR INSERT
TO authenticated
WITH CHECK (true);
