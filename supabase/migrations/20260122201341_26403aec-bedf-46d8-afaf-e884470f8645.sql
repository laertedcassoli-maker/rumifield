-- =============================================
-- 1) Associação Ação Corretiva ↔ Peças (Template)
-- =============================================
CREATE TABLE public.checklist_action_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.checklist_item_corrective_actions(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.pecas(id) ON DELETE CASCADE,
  default_quantity DECIMAL NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Evita duplicatas
  UNIQUE(action_id, part_id)
);

-- Índices
CREATE INDEX idx_checklist_action_parts_action_id ON public.checklist_action_parts(action_id);
CREATE INDEX idx_checklist_action_parts_part_id ON public.checklist_action_parts(part_id);

-- RLS
ALTER TABLE public.checklist_action_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checklist_action_parts"
  ON public.checklist_action_parts FOR SELECT
  USING (true);

CREATE POLICY "Admins and coordinators can manage checklist_action_parts"
  ON public.checklist_action_parts FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- =============================================
-- 2) Registro de Consumo de Peças (Execução)
-- =============================================
CREATE TABLE public.preventive_part_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preventive_id UUID NOT NULL REFERENCES public.preventive_maintenance(id) ON DELETE CASCADE,
  exec_item_id UUID NOT NULL REFERENCES public.preventive_checklist_items(id) ON DELETE CASCADE,
  exec_action_id UUID NOT NULL REFERENCES public.preventive_checklist_item_actions(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.pecas(id),
  part_code_snapshot TEXT NOT NULL,
  part_name_snapshot TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 1,
  unit_cost_snapshot DECIMAL,
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Evita duplicatas (uma peça por ação executada)
  UNIQUE(exec_action_id, part_id)
);

-- Índices para consultas frequentes
CREATE INDEX idx_preventive_part_consumption_preventive_id ON public.preventive_part_consumption(preventive_id);
CREATE INDEX idx_preventive_part_consumption_exec_item_id ON public.preventive_part_consumption(exec_item_id);
CREATE INDEX idx_preventive_part_consumption_exec_action_id ON public.preventive_part_consumption(exec_action_id);
CREATE INDEX idx_preventive_part_consumption_part_id ON public.preventive_part_consumption(part_id);
CREATE INDEX idx_preventive_part_consumption_consumed_at ON public.preventive_part_consumption(consumed_at);

-- RLS
ALTER TABLE public.preventive_part_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read preventive_part_consumption"
  ON public.preventive_part_consumption FOR SELECT
  USING (true);

CREATE POLICY "Technicians can insert preventive_part_consumption"
  ON public.preventive_part_consumption FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and coordinators can manage preventive_part_consumption"
  ON public.preventive_part_consumption FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));