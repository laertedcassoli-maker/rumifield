-- 0. Restringir leituras abertas a usuários logados
DROP POLICY IF EXISTS "Authenticated users can read preventive_checklists" ON public.preventive_checklists;
CREATE POLICY "Authenticated users can read preventive_checklists" ON public.preventive_checklists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Public read for checklists via preventive token" ON public.preventive_checklists;
CREATE POLICY "Public read for checklists via preventive token" ON public.preventive_checklists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read preventive_checklist_blocks" ON public.preventive_checklist_blocks;
CREATE POLICY "Authenticated users can read preventive_checklist_blocks" ON public.preventive_checklist_blocks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read preventive_checklist_items" ON public.preventive_checklist_items;
CREATE POLICY "Authenticated users can read preventive_checklist_items" ON public.preventive_checklist_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read preventive_checklist_item_nonconfo" ON public.preventive_checklist_item_nonconformities;
CREATE POLICY "Authenticated users can read preventive_checklist_item_nonconfo" ON public.preventive_checklist_item_nonconformities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read preventive_checklist_item_actions" ON public.preventive_checklist_item_actions;
CREATE POLICY "Authenticated users can read preventive_checklist_item_actions" ON public.preventive_checklist_item_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read preventive_part_consumption" ON public.preventive_part_consumption;
CREATE POLICY "Authenticated users can read preventive_part_consumption" ON public.preventive_part_consumption FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Public read for part consumption" ON public.preventive_part_consumption;
CREATE POLICY "Public read for part consumption" ON public.preventive_part_consumption FOR SELECT TO authenticated USING (true);

-- 1. Funções
CREATE OR REPLACE FUNCTION public.is_public_preventive_visit(_preventive_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.preventive_maintenance pm
    WHERE pm.id = _preventive_id
      AND (
        pm.public_token IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.corrective_maintenance cm
          WHERE cm.public_token IS NOT NULL
            AND cm.client_id = pm.client_id
            AND pm.notes ILIKE '%CORR-VISIT-' || cm.visit_id::text || '%'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.preventive_id_of_checklist(_checklist_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT preventive_id FROM public.preventive_checklists WHERE id = _checklist_id
$$;

CREATE OR REPLACE FUNCTION public.preventive_id_of_block(_block_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.preventive_id FROM public.preventive_checklist_blocks b
  JOIN public.preventive_checklists c ON c.id = b.checklist_id WHERE b.id = _block_id
$$;

CREATE OR REPLACE FUNCTION public.preventive_id_of_item(_item_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.preventive_id FROM public.preventive_checklist_items i
  JOIN public.preventive_checklist_blocks b ON b.id = i.exec_block_id
  JOIN public.preventive_checklists c ON c.id = b.checklist_id WHERE i.id = _item_id
$$;

GRANT EXECUTE ON FUNCTION public.is_public_preventive_visit(uuid), public.preventive_id_of_checklist(uuid), public.preventive_id_of_block(uuid), public.preventive_id_of_item(uuid) TO anon, authenticated;

-- 2. Permissão de leitura para visitante
GRANT SELECT ON public.preventive_checklists, public.preventive_checklist_blocks, public.preventive_checklist_items, public.preventive_checklist_item_nonconformities, public.preventive_checklist_item_actions, public.preventive_part_consumption, public.preventive_visit_media TO anon;

-- 3. Regras de visitante
CREATE POLICY "Anon read checklists of public report" ON public.preventive_checklists FOR SELECT TO anon USING (public.is_public_preventive_visit(preventive_id));
CREATE POLICY "Anon read parts of public report" ON public.preventive_part_consumption FOR SELECT TO anon USING (public.is_public_preventive_visit(preventive_id));
CREATE POLICY "Anon read media of public report" ON public.preventive_visit_media FOR SELECT TO anon USING (public.is_public_preventive_visit(preventive_id));
CREATE POLICY "Anon read blocks of public report" ON public.preventive_checklist_blocks FOR SELECT TO anon USING (public.is_public_preventive_visit(public.preventive_id_of_checklist(checklist_id)));
CREATE POLICY "Anon read items of public report" ON public.preventive_checklist_items FOR SELECT TO anon USING (public.is_public_preventive_visit(public.preventive_id_of_block(exec_block_id)));
CREATE POLICY "Anon read nonconformities of public report" ON public.preventive_checklist_item_nonconformities FOR SELECT TO anon USING (public.is_public_preventive_visit(public.preventive_id_of_item(exec_item_id)));
CREATE POLICY "Anon read actions of public report" ON public.preventive_checklist_item_actions FOR SELECT TO anon USING (public.is_public_preventive_visit(public.preventive_id_of_item(exec_item_id)));