-- 1) Novas colunas em installation_stages (todas nullable; exclusividade tecnico/CSM validada na aplicacao)
ALTER TABLE public.installation_stages
  ADD COLUMN IF NOT EXISTS csm_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sales_email_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2) Nova funcao: responsavel = tecnico OU CSM da etapa.
-- SECURITY DEFINER para evitar recursao de RLS ao consultar installation_stages dentro das policies.
CREATE OR REPLACE FUNCTION public.is_installation_stage_responsible(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.installation_stages s
    WHERE s.id = _stage_id
      AND (s.technician_user_id = _user_id OR s.csm_user_id = _user_id)
  )
$$;

-- 3) Policies de escrita de execucao passam a usar is_installation_stage_responsible
DROP POLICY IF EXISTS "Technicians can insert own installation_checklists" ON public.installation_checklists;
CREATE POLICY "Technicians can insert own installation_checklists"
ON public.installation_checklists FOR INSERT TO authenticated
WITH CHECK (public.is_installation_stage_responsible(auth.uid(), installation_stage_id));

DROP POLICY IF EXISTS "Technicians can update own installation_checklists" ON public.installation_checklists;
CREATE POLICY "Technicians can update own installation_checklists"
ON public.installation_checklists FOR UPDATE TO authenticated
USING (public.is_installation_stage_responsible(auth.uid(), installation_stage_id))
WITH CHECK (public.is_installation_stage_responsible(auth.uid(), installation_stage_id));

DROP POLICY IF EXISTS "Technicians can write own installation_checklist_blocks" ON public.installation_checklist_blocks;
CREATE POLICY "Technicians can write own installation_checklist_blocks"
ON public.installation_checklist_blocks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.installation_checklists c
  WHERE c.id = installation_checklist_blocks.checklist_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.installation_checklists c
  WHERE c.id = installation_checklist_blocks.checklist_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
));

DROP POLICY IF EXISTS "Technicians can write own installation_checklist_items" ON public.installation_checklist_items;
CREATE POLICY "Technicians can write own installation_checklist_items"
ON public.installation_checklist_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.installation_checklist_blocks b
  JOIN public.installation_checklists c ON c.id = b.checklist_id
  WHERE b.id = installation_checklist_items.exec_block_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.installation_checklist_blocks b
  JOIN public.installation_checklists c ON c.id = b.checklist_id
  WHERE b.id = installation_checklist_items.exec_block_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
));

DROP POLICY IF EXISTS "Technicians can write own installation_checklist_item_actions" ON public.installation_checklist_item_actions;
CREATE POLICY "Technicians can write own installation_checklist_item_actions"
ON public.installation_checklist_item_actions FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.installation_checklist_items i
  JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
  JOIN public.installation_checklists c ON c.id = b.checklist_id
  WHERE i.id = installation_checklist_item_actions.exec_item_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.installation_checklist_items i
  JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
  JOIN public.installation_checklists c ON c.id = b.checklist_id
  WHERE i.id = installation_checklist_item_actions.exec_item_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
));

DROP POLICY IF EXISTS "Technicians can write own installation_checklist_item_nonconfor" ON public.installation_checklist_item_nonconformities;
CREATE POLICY "Technicians can write own installation_checklist_item_nonconfor"
ON public.installation_checklist_item_nonconformities FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.installation_checklist_items i
  JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
  JOIN public.installation_checklists c ON c.id = b.checklist_id
  WHERE i.id = installation_checklist_item_nonconformities.exec_item_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.installation_checklist_items i
  JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
  JOIN public.installation_checklists c ON c.id = b.checklist_id
  WHERE i.id = installation_checklist_item_nonconformities.exec_item_id
    AND public.is_installation_stage_responsible(auth.uid(), c.installation_stage_id)
));

DROP POLICY IF EXISTS "Technicians can write own installation_part_consumption" ON public.installation_part_consumption;
CREATE POLICY "Technicians can write own installation_part_consumption"
ON public.installation_part_consumption FOR ALL TO authenticated
USING (public.is_installation_stage_responsible(auth.uid(), installation_stage_id))
WITH CHECK (public.is_installation_stage_responsible(auth.uid(), installation_stage_id));

-- installation_stages: responsavel (tecnico OU CSM) pode atualizar a propria etapa
DROP POLICY IF EXISTS "Technicians can update own installation_stages" ON public.installation_stages;
CREATE POLICY "Technicians can update own installation_stages"
ON public.installation_stages FOR UPDATE TO authenticated
USING (technician_user_id = auth.uid() OR csm_user_id = auth.uid())
WITH CHECK (technician_user_id = auth.uid() OR csm_user_id = auth.uid());

-- 4) Policies do bucket privado instalacao-anexos (path: <stage_id>/<arquivo>)
-- Comparacao por texto (sem cast para uuid) para nao lancar erro em caminhos invalidos.
DROP POLICY IF EXISTS "Instalacao anexos select" ON storage.objects;
CREATE POLICY "Instalacao anexos select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'instalacao-anexos' AND (
    EXISTS (
      SELECT 1 FROM public.installation_stages s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.technician_user_id = auth.uid() OR s.csm_user_id = auth.uid())
    ) OR public.can_manage_installations()
  )
);

DROP POLICY IF EXISTS "Instalacao anexos insert" ON storage.objects;
CREATE POLICY "Instalacao anexos insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'instalacao-anexos' AND (
    EXISTS (
      SELECT 1 FROM public.installation_stages s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.technician_user_id = auth.uid() OR s.csm_user_id = auth.uid())
    ) OR public.can_manage_installations()
  )
);

DROP POLICY IF EXISTS "Instalacao anexos update" ON storage.objects;
CREATE POLICY "Instalacao anexos update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'instalacao-anexos' AND (
    EXISTS (
      SELECT 1 FROM public.installation_stages s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.technician_user_id = auth.uid() OR s.csm_user_id = auth.uid())
    ) OR public.can_manage_installations()
  )
)
WITH CHECK (
  bucket_id = 'instalacao-anexos' AND (
    EXISTS (
      SELECT 1 FROM public.installation_stages s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.technician_user_id = auth.uid() OR s.csm_user_id = auth.uid())
    ) OR public.can_manage_installations()
  )
);

DROP POLICY IF EXISTS "Instalacao anexos delete" ON storage.objects;
CREATE POLICY "Instalacao anexos delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'instalacao-anexos' AND (
    EXISTS (
      SELECT 1 FROM public.installation_stages s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.technician_user_id = auth.uid() OR s.csm_user_id = auth.uid())
    ) OR public.can_manage_installations()
  )
);