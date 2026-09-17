CREATE POLICY "Pedido anexos select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pedido-anexos' AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.solicitante_id = auth.uid()
        OR p.tecnico_responsavel_user_id = auth.uid()
        OR p.csm_responsavel_user_id = auth.uid()
        OR public.is_admin_or_coordinator(auth.uid()))
  )
);

CREATE POLICY "Pedido anexos insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pedido-anexos' AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.solicitante_id = auth.uid()
        OR p.tecnico_responsavel_user_id = auth.uid()
        OR p.csm_responsavel_user_id = auth.uid()
        OR public.is_admin_or_coordinator(auth.uid()))
  )
);

CREATE POLICY "Pedido anexos update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pedido-anexos' AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.solicitante_id = auth.uid()
        OR p.tecnico_responsavel_user_id = auth.uid()
        OR p.csm_responsavel_user_id = auth.uid()
        OR public.is_admin_or_coordinator(auth.uid()))
  )
)
WITH CHECK (
  bucket_id = 'pedido-anexos' AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.solicitante_id = auth.uid()
        OR p.tecnico_responsavel_user_id = auth.uid()
        OR p.csm_responsavel_user_id = auth.uid()
        OR public.is_admin_or_coordinator(auth.uid()))
  )
);

CREATE POLICY "Pedido anexos delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pedido-anexos' AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.solicitante_id = auth.uid()
        OR p.tecnico_responsavel_user_id = auth.uid()
        OR p.csm_responsavel_user_id = auth.uid()
        OR public.is_admin_or_coordinator(auth.uid()))
  )
);