ALTER TABLE public.installation_stages
  ADD COLUMN IF NOT EXISTS observacao_interna text,
  ADD COLUMN IF NOT EXISTS observacao_externa text,
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

CREATE TABLE public.installation_visit_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.installation_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.installation_visit_media(stage_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_visit_media TO authenticated;
GRANT SELECT ON public.installation_visit_media TO anon;
GRANT ALL ON public.installation_visit_media TO service_role;
ALTER TABLE public.installation_visit_media ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_public_installation_stage(_stage_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.installation_stages s
    WHERE s.id = _stage_id AND s.stage = 'instalacao' AND s.status = 'concluido' AND s.public_token IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION public.installation_stage_of_checklist(_checklist_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT installation_stage_id FROM public.installation_checklists WHERE id = _checklist_id
$$;
CREATE OR REPLACE FUNCTION public.installation_stage_of_block(_block_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.installation_stage_id FROM public.installation_checklist_blocks b
  JOIN public.installation_checklists c ON c.id = b.checklist_id WHERE b.id = _block_id
$$;
CREATE OR REPLACE FUNCTION public.installation_stage_of_item(_item_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.installation_stage_id FROM public.installation_checklist_items i
  JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
  JOIN public.installation_checklists c ON c.id = b.checklist_id WHERE i.id = _item_id
$$;

CREATE POLICY "Team reads installation media" ON public.installation_visit_media
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team inserts own installation media" ON public.installation_visit_media
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin deletes installation media" ON public.installation_visit_media
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Public reads installation media by report" ON public.installation_visit_media
  FOR SELECT TO anon USING (public.is_public_installation_stage(stage_id));

GRANT SELECT ON public.installation_stages, public.installations, public.installation_checklists,
  public.installation_checklist_blocks, public.installation_checklist_items,
  public.installation_checklist_item_nonconformities, public.installation_checklist_item_actions,
  public.installation_part_consumption TO anon;

CREATE POLICY "Public reads installation stage by report" ON public.installation_stages
  FOR SELECT TO anon USING (public.is_public_installation_stage(id));
CREATE POLICY "Public reads installation by report" ON public.installations
  FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.installation_stages s WHERE s.installation_id = installations.id AND public.is_public_installation_stage(s.id)));
CREATE POLICY "Public reads installation checklist by report" ON public.installation_checklists
  FOR SELECT TO anon USING (public.is_public_installation_stage(installation_stage_id));
CREATE POLICY "Public reads installation blocks by report" ON public.installation_checklist_blocks
  FOR SELECT TO anon USING (public.is_public_installation_stage(public.installation_stage_of_checklist(checklist_id)));
CREATE POLICY "Public reads installation items by report" ON public.installation_checklist_items
  FOR SELECT TO anon USING (public.is_public_installation_stage(public.installation_stage_of_block(exec_block_id)));
CREATE POLICY "Public reads installation nonconformities by report" ON public.installation_checklist_item_nonconformities
  FOR SELECT TO anon USING (public.is_public_installation_stage(public.installation_stage_of_item(exec_item_id)));
CREATE POLICY "Public reads installation actions by report" ON public.installation_checklist_item_actions
  FOR SELECT TO anon USING (public.is_public_installation_stage(public.installation_stage_of_item(exec_item_id)));
CREATE POLICY "Public reads installation parts by report" ON public.installation_part_consumption
  FOR SELECT TO anon USING (public.is_public_installation_stage(installation_stage_id));

CREATE OR REPLACE FUNCTION public.get_public_installation_header(_token uuid)
RETURNS TABLE(stage_id uuid, cliente_nome text, fazenda text, cidade text, estado text, tecnico_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, c.nome, c.fazenda, c.cidade, c.estado, p.nome
  FROM public.installation_stages s
  JOIN public.installations i ON i.id = s.installation_id
  LEFT JOIN public.clientes c ON c.id = i.cliente_id
  LEFT JOIN public.profiles p ON p.id = COALESCE(s.technician_user_id, s.csm_user_id)
  WHERE s.public_token = _token AND public.is_public_installation_stage(s.id)
$$;
GRANT EXECUTE ON FUNCTION public.get_public_installation_header(uuid) TO anon, authenticated;

CREATE POLICY "Public read installation media files via report" ON storage.objects
  FOR SELECT TO anon USING (
    bucket_id = 'preventive-media' AND (storage.foldername(name))[2] = 'installation'
    AND public.is_public_installation_stage(((storage.foldername(name))[3])::uuid)
  );