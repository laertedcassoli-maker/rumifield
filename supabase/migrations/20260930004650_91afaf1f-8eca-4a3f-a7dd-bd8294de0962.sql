CREATE TABLE public.preventive_checklist_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.preventive_checklist_items(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcip_item ON public.preventive_checklist_item_photos(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preventive_checklist_item_photos TO authenticated;
GRANT SELECT ON public.preventive_checklist_item_photos TO anon;
GRANT ALL ON public.preventive_checklist_item_photos TO service_role;
ALTER TABLE public.preventive_checklist_item_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read preventive item photos" ON public.preventive_checklist_item_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage preventive item photos" ON public.preventive_checklist_item_photos FOR ALL TO authenticated USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Technicians insert preventive item photos" ON public.preventive_checklist_item_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Technicians update preventive item photos" ON public.preventive_checklist_item_photos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM preventive_checklist_items i JOIN preventive_checklist_blocks b ON b.id = i.exec_block_id JOIN preventive_checklists c ON c.id = b.checklist_id WHERE i.id = item_id AND c.status = 'em_andamento'));
CREATE POLICY "Technicians delete preventive item photos" ON public.preventive_checklist_item_photos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM preventive_checklist_items i JOIN preventive_checklist_blocks b ON b.id = i.exec_block_id JOIN preventive_checklists c ON c.id = b.checklist_id WHERE i.id = item_id AND c.status = 'em_andamento'));
CREATE POLICY "Anon read preventive item photos of public report" ON public.preventive_checklist_item_photos FOR SELECT TO anon USING (is_public_preventive_visit(preventive_id_of_item(item_id)));

CREATE TABLE public.installation_checklist_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.installation_checklist_items(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_icip_item ON public.installation_checklist_item_photos(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_checklist_item_photos TO authenticated;
GRANT SELECT ON public.installation_checklist_item_photos TO anon;
GRANT ALL ON public.installation_checklist_item_photos TO service_role;
ALTER TABLE public.installation_checklist_item_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read installation item photos" ON public.installation_checklist_item_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage installation item photos" ON public.installation_checklist_item_photos FOR ALL TO authenticated USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Technicians write own installation item photos" ON public.installation_checklist_item_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM installation_checklist_items i JOIN installation_checklist_blocks b ON b.id = i.exec_block_id JOIN installation_checklists c ON c.id = b.checklist_id WHERE i.id = item_id AND is_installation_stage_responsible(auth.uid(), c.installation_stage_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM installation_checklist_items i JOIN installation_checklist_blocks b ON b.id = i.exec_block_id JOIN installation_checklists c ON c.id = b.checklist_id WHERE i.id = item_id AND is_installation_stage_responsible(auth.uid(), c.installation_stage_id)));
CREATE POLICY "Anon read installation item photos of public report" ON public.installation_checklist_item_photos FOR SELECT TO anon USING (is_public_installation_stage(installation_stage_of_item(item_id)));

INSERT INTO public.preventive_checklist_item_photos (item_id, photo_path) SELECT id, photo_path FROM public.preventive_checklist_items WHERE photo_path IS NOT NULL;
INSERT INTO public.installation_checklist_item_photos (item_id, photo_path) SELECT id, photo_path FROM public.installation_checklist_items WHERE photo_path IS NOT NULL;