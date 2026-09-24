CREATE POLICY "Admin can manage configuracoes"
ON public.configuracoes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));