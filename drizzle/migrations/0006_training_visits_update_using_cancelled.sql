DROP POLICY IF EXISTS "Authenticated can update training visits" ON public.training_visits;
CREATE POLICY "Authenticated can update training visits" ON public.training_visits
FOR UPDATE TO authenticated
USING (status IS DISTINCT FROM 'cancelada' OR public.can_cancel_treinamento(auth.uid()))
WITH CHECK (status IS DISTINCT FROM 'cancelada' OR public.can_cancel_treinamento(auth.uid()));