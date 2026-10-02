ALTER TABLE public.estoque_consumo_itens
  ADD COLUMN unidade text NOT NULL DEFAULT 'un' CHECK (unidade IN ('un','m','kg','L','cx','rolo','par','pç')),
  ADD COLUMN controle_consumo text NOT NULL DEFAULT 'por_uso' CHECK (controle_consumo IN ('por_uso','a_granel'));

DROP POLICY IF EXISTS "Insert estoque movimentos by tipo" ON public.estoque_consumo_movimentos;
DROP POLICY IF EXISTS "Insert movimentos estoque consumo" ON public.estoque_consumo_movimentos;
CREATE POLICY "Insert movimentos estoque consumo" ON public.estoque_consumo_movimentos
FOR INSERT TO authenticated
WITH CHECK (
  (tipo = 'entrada' AND (public.can_manage_estoque_consumo(auth.uid())
     OR (local = 'tecnico' AND tecnico_user_id = auth.uid() AND public.can_registrar_saida_estoque(auth.uid()))))
  OR (tipo = 'saida' AND public.can_registrar_saida_estoque(auth.uid())
     AND (local = 'centro_servicos' OR tecnico_user_id = auth.uid() OR public.can_manage_estoque_consumo(auth.uid())))
);