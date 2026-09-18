-- Instalações — Fase 1: espelho das tabelas de execução de checklist + consumo de peças
-- Caminho paralelo ao preventivo: tabelas novas referenciam installation_checklists /
-- installation_stages (nunca preventive_maintenance nem preventive_checklists).
--
-- RLS (filosofia já documentada em supabase/migrations/CLAUDE.md para tabelas
-- operacionais): leitura ampla para authenticated; escrita de gestão via
-- can_manage_installations() (admin/coordenadores + consultor_rplus); escrita de
-- execução pelo técnico designado da etapa (technician_user_id = auth.uid()).

-- Função de gestão do módulo (SECURITY DEFINER para evitar recursão de RLS)
CREATE OR REPLACE FUNCTION public.can_manage_installations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'consultor_rplus')
$$;

-- Helper: usuário é o técnico designado de uma etapa
CREATE OR REPLACE FUNCTION public.is_installation_stage_technician(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.installation_stages s
    WHERE s.id = _stage_id AND s.technician_user_id = _user_id
  )
$$;

-- Gestão das tabelas base passa a incluir consultor_rplus
DROP POLICY "Admins and coordinators can manage installations" ON public.installations;
CREATE POLICY "Managers can manage installations"
ON public.installations FOR ALL
TO authenticated
USING (can_manage_installations())
WITH CHECK (can_manage_installations());

DROP POLICY "Admins and coordinators can manage installation_stages" ON public.installation_stages;
CREATE POLICY "Managers can manage installation_stages"
ON public.installation_stages FOR ALL
TO authenticated
USING (can_manage_installations())
WITH CHECK (can_manage_installations());

DROP POLICY "Admins and coordinators can manage installation_checklists" ON public.installation_checklists;
CREATE POLICY "Managers can manage installation_checklists"
ON public.installation_checklists FOR ALL
TO authenticated
USING (can_manage_installations())
WITH CHECK (can_manage_installations());

-- Blocos da execução (espelho de preventive_checklist_blocks)
CREATE TABLE public.installation_checklist_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.installation_checklists(id) ON DELETE CASCADE,
  template_block_id UUID REFERENCES public.checklist_template_blocks(id),
  block_name_snapshot TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_checklist_blocks TO authenticated;
GRANT ALL ON public.installation_checklist_blocks TO service_role;
ALTER TABLE public.installation_checklist_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read installation_checklist_blocks"
ON public.installation_checklist_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage installation_checklist_blocks"
ON public.installation_checklist_blocks FOR ALL TO authenticated
USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Technicians can write own installation_checklist_blocks"
ON public.installation_checklist_blocks FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.installation_checklists c
    WHERE c.id = installation_checklist_blocks.checklist_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.installation_checklists c
    WHERE c.id = installation_checklist_blocks.checklist_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
);
CREATE INDEX idx_inst_checklist_blocks_checklist ON public.installation_checklist_blocks(checklist_id);

-- Itens da execução (espelho de preventive_checklist_items)
CREATE TABLE public.installation_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exec_block_id UUID NOT NULL REFERENCES public.installation_checklist_blocks(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES public.checklist_template_items(id),
  item_name_snapshot TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  status checklist_item_status,
  notes TEXT,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_checklist_items TO authenticated;
GRANT ALL ON public.installation_checklist_items TO service_role;
ALTER TABLE public.installation_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read installation_checklist_items"
ON public.installation_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage installation_checklist_items"
ON public.installation_checklist_items FOR ALL TO authenticated
USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Technicians can write own installation_checklist_items"
ON public.installation_checklist_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.installation_checklist_blocks b
    JOIN public.installation_checklists c ON c.id = b.checklist_id
    WHERE b.id = installation_checklist_items.exec_block_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.installation_checklist_blocks b
    JOIN public.installation_checklists c ON c.id = b.checklist_id
    WHERE b.id = installation_checklist_items.exec_block_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
);
CREATE INDEX idx_inst_checklist_items_block ON public.installation_checklist_items(exec_block_id);

-- Ações corretivas marcadas por item (espelho de preventive_checklist_item_actions)
CREATE TABLE public.installation_checklist_item_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exec_item_id UUID NOT NULL REFERENCES public.installation_checklist_items(id) ON DELETE CASCADE,
  template_action_id UUID REFERENCES public.checklist_item_corrective_actions(id),
  action_label_snapshot TEXT NOT NULL,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (exec_item_id, template_action_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_checklist_item_actions TO authenticated;
GRANT ALL ON public.installation_checklist_item_actions TO service_role;
ALTER TABLE public.installation_checklist_item_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read installation_checklist_item_actions"
ON public.installation_checklist_item_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage installation_checklist_item_actions"
ON public.installation_checklist_item_actions FOR ALL TO authenticated
USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Technicians can write own installation_checklist_item_actions"
ON public.installation_checklist_item_actions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.installation_checklist_items i
    JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
    JOIN public.installation_checklists c ON c.id = b.checklist_id
    WHERE i.id = installation_checklist_item_actions.exec_item_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.installation_checklist_items i
    JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
    JOIN public.installation_checklists c ON c.id = b.checklist_id
    WHERE i.id = installation_checklist_item_actions.exec_item_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
);
CREATE INDEX idx_inst_checklist_actions_item ON public.installation_checklist_item_actions(exec_item_id);

-- Não conformidades marcadas por item (espelho de preventive_checklist_item_nonconformities)
CREATE TABLE public.installation_checklist_item_nonconformities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exec_item_id UUID NOT NULL REFERENCES public.installation_checklist_items(id) ON DELETE CASCADE,
  template_nonconformity_id UUID REFERENCES public.checklist_item_nonconformities(id),
  nonconformity_label_snapshot TEXT NOT NULL,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (exec_item_id, template_nonconformity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_checklist_item_nonconformities TO authenticated;
GRANT ALL ON public.installation_checklist_item_nonconformities TO service_role;
ALTER TABLE public.installation_checklist_item_nonconformities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read installation_checklist_item_nonconformities"
ON public.installation_checklist_item_nonconformities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage installation_checklist_item_nonconformities"
ON public.installation_checklist_item_nonconformities FOR ALL TO authenticated
USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Technicians can write own installation_checklist_item_nonconformities"
ON public.installation_checklist_item_nonconformities FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.installation_checklist_items i
    JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
    JOIN public.installation_checklists c ON c.id = b.checklist_id
    WHERE i.id = installation_checklist_item_nonconformities.exec_item_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.installation_checklist_items i
    JOIN public.installation_checklist_blocks b ON b.id = i.exec_block_id
    JOIN public.installation_checklists c ON c.id = b.checklist_id
    WHERE i.id = installation_checklist_item_nonconformities.exec_item_id
      AND is_installation_stage_technician(auth.uid(), c.installation_stage_id)
  )
);
CREATE INDEX idx_inst_checklist_nc_item ON public.installation_checklist_item_nonconformities(exec_item_id);

-- Consumo de peças na etapa (espelho de preventive_part_consumption)
CREATE TABLE public.installation_part_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_stage_id UUID NOT NULL REFERENCES public.installation_stages(id) ON DELETE CASCADE,
  exec_item_id UUID REFERENCES public.installation_checklist_items(id) ON DELETE SET NULL,
  exec_nonconformity_id UUID REFERENCES public.installation_checklist_item_nonconformities(id) ON DELETE SET NULL,
  part_id UUID NOT NULL REFERENCES public.pecas(id),
  part_code_snapshot TEXT NOT NULL,
  part_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  stock_source TEXT,
  is_manual BOOLEAN DEFAULT false,
  notes TEXT,
  unit_cost_snapshot NUMERIC,
  asset_unique_code TEXT,
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_part_consumption TO authenticated;
GRANT ALL ON public.installation_part_consumption TO service_role;
ALTER TABLE public.installation_part_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read installation_part_consumption"
ON public.installation_part_consumption FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage installation_part_consumption"
ON public.installation_part_consumption FOR ALL TO authenticated
USING (can_manage_installations()) WITH CHECK (can_manage_installations());
CREATE POLICY "Technicians can write own installation_part_consumption"
ON public.installation_part_consumption FOR ALL TO authenticated
USING (is_installation_stage_technician(auth.uid(), installation_stage_id))
WITH CHECK (is_installation_stage_technician(auth.uid(), installation_stage_id));
CREATE INDEX idx_inst_part_consumption_stage ON public.installation_part_consumption(installation_stage_id);
CREATE INDEX idx_inst_part_consumption_nc ON public.installation_part_consumption(exec_nonconformity_id);
CREATE INDEX idx_inst_part_consumption_item ON public.installation_part_consumption(exec_item_id);