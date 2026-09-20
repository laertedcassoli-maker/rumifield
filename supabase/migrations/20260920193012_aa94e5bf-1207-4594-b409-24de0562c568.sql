CREATE POLICY "Correios reports insert by managers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'correios-relatorios' AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador_servicos')
    OR public.has_role(auth.uid(), 'coordenador_logistica')
  )
);

CREATE POLICY "Correios reports select by managers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'correios-relatorios' AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador_servicos')
    OR public.has_role(auth.uid(), 'coordenador_logistica')
  )
);

CREATE POLICY "Correios reports delete by managers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'correios-relatorios' AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador_servicos')
    OR public.has_role(auth.uid(), 'coordenador_logistica')
  )
);