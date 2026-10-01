DROP POLICY IF EXISTS "Insert entrada movimentos" ON public.estoque_consumo_movimentos;
DROP POLICY IF EXISTS "Insert saida movimentos" ON public.estoque_consumo_movimentos;

CREATE POLICY "Insert movimentos estoque consumo"
ON public.estoque_consumo_movimentos
FOR INSERT
TO authenticated
WITH CHECK (
  (tipo = 'entrada' AND (
    public.can_manage_estoque_consumo(auth.uid())
    OR (local = 'tecnico' AND tecnico_user_id = auth.uid() AND public.can_registrar_saida_estoque(auth.uid()))
  ))
  OR
  (tipo = 'saida' AND public.can_registrar_saida_estoque(auth.uid()))
);