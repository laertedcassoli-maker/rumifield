
-- Enum for checklist execution status
CREATE TYPE checklist_execution_status AS ENUM ('em_andamento', 'concluido');

-- Enum for item check status
CREATE TYPE checklist_item_status AS ENUM ('S', 'N', 'NA');

-- 1) Templates de Checklist
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checklist_templates"
ON public.checklist_templates FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage checklist_templates"
ON public.checklist_templates FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- 2) Blocos do Template
CREATE TABLE public.checklist_template_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  block_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_template_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checklist_template_blocks"
ON public.checklist_template_blocks FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage checklist_template_blocks"
ON public.checklist_template_blocks FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- 3) Itens de verificação (por bloco)
CREATE TABLE public.checklist_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID NOT NULL REFERENCES public.checklist_template_blocks(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checklist_template_items"
ON public.checklist_template_items FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage checklist_template_items"
ON public.checklist_template_items FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- 4) Ações corretivas permitidas (por item)
CREATE TABLE public.checklist_item_corrective_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.checklist_template_items(id) ON DELETE CASCADE,
  action_label TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_item_corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checklist_item_corrective_actions"
ON public.checklist_item_corrective_actions FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage checklist_item_corrective_actions"
ON public.checklist_item_corrective_actions FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- 5) Checklist aplicado a uma Preventiva (Execução)
CREATE TABLE public.preventive_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preventive_id UUID NOT NULL REFERENCES public.preventive_maintenance(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id),
  status checklist_execution_status NOT NULL DEFAULT 'em_andamento',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.preventive_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read preventive_checklists"
ON public.preventive_checklists FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage preventive_checklists"
ON public.preventive_checklists FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Technicians can insert preventive_checklists"
ON public.preventive_checklists FOR INSERT
WITH CHECK (true);

CREATE POLICY "Technicians can update own preventive_checklists"
ON public.preventive_checklists FOR UPDATE
USING (status = 'em_andamento');

-- 6) Snapshots - Blocos congelados na execução
CREATE TABLE public.preventive_checklist_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.preventive_checklists(id) ON DELETE CASCADE,
  template_block_id UUID REFERENCES public.checklist_template_blocks(id) ON DELETE SET NULL,
  block_name_snapshot TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.preventive_checklist_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read preventive_checklist_blocks"
ON public.preventive_checklist_blocks FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage preventive_checklist_blocks"
ON public.preventive_checklist_blocks FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Technicians can insert preventive_checklist_blocks"
ON public.preventive_checklist_blocks FOR INSERT
WITH CHECK (true);

-- 6) Snapshots - Itens congelados na execução
CREATE TABLE public.preventive_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exec_block_id UUID NOT NULL REFERENCES public.preventive_checklist_blocks(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES public.checklist_template_items(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  status checklist_item_status,
  notes TEXT,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.preventive_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read preventive_checklist_items"
ON public.preventive_checklist_items FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage preventive_checklist_items"
ON public.preventive_checklist_items FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Technicians can insert preventive_checklist_items"
ON public.preventive_checklist_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Technicians can update preventive_checklist_items"
ON public.preventive_checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.preventive_checklist_blocks pcb
    JOIN public.preventive_checklists pc ON pc.id = pcb.checklist_id
    WHERE pcb.id = preventive_checklist_items.exec_block_id
    AND pc.status = 'em_andamento'
  )
);

-- 7) Ações corretivas selecionadas na execução
CREATE TABLE public.preventive_checklist_item_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exec_item_id UUID NOT NULL REFERENCES public.preventive_checklist_items(id) ON DELETE CASCADE,
  template_action_id UUID REFERENCES public.checklist_item_corrective_actions(id) ON DELETE SET NULL,
  action_label_snapshot TEXT NOT NULL,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.preventive_checklist_item_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read preventive_checklist_item_actions"
ON public.preventive_checklist_item_actions FOR SELECT
USING (true);

CREATE POLICY "Admins and coordinators can manage preventive_checklist_item_actions"
ON public.preventive_checklist_item_actions FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Technicians can insert preventive_checklist_item_actions"
ON public.preventive_checklist_item_actions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.preventive_checklist_items pci
    WHERE pci.id = preventive_checklist_item_actions.exec_item_id
    AND pci.status = 'N'
  )
);

CREATE POLICY "Technicians can delete preventive_checklist_item_actions"
ON public.preventive_checklist_item_actions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.preventive_checklist_items pci
    JOIN public.preventive_checklist_blocks pcb ON pcb.id = pci.exec_block_id
    JOIN public.preventive_checklists pc ON pc.id = pcb.checklist_id
    WHERE pci.id = preventive_checklist_item_actions.exec_item_id
    AND pc.status = 'em_andamento'
  )
);

-- Índices para performance
CREATE INDEX idx_checklist_template_blocks_template_id ON public.checklist_template_blocks(template_id);
CREATE INDEX idx_checklist_template_items_block_id ON public.checklist_template_items(block_id);
CREATE INDEX idx_checklist_item_corrective_actions_item_id ON public.checklist_item_corrective_actions(item_id);
CREATE INDEX idx_preventive_checklists_preventive_id ON public.preventive_checklists(preventive_id);
CREATE INDEX idx_preventive_checklist_blocks_checklist_id ON public.preventive_checklist_blocks(checklist_id);
CREATE INDEX idx_preventive_checklist_items_exec_block_id ON public.preventive_checklist_items(exec_block_id);
CREATE INDEX idx_preventive_checklist_item_actions_exec_item_id ON public.preventive_checklist_item_actions(exec_item_id);
