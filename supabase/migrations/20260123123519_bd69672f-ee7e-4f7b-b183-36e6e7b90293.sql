-- =============================================
-- 1) Criar tabela para associar peças às Não Conformidades
-- =============================================
CREATE TABLE public.checklist_nonconformity_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nonconformity_id UUID NOT NULL REFERENCES public.checklist_item_nonconformities(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.pecas(id) ON DELETE CASCADE,
  default_quantity DECIMAL NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(nonconformity_id, part_id)
);

CREATE INDEX idx_checklist_nonconformity_parts_nc_id ON public.checklist_nonconformity_parts(nonconformity_id);
CREATE INDEX idx_checklist_nonconformity_parts_part_id ON public.checklist_nonconformity_parts(part_id);

ALTER TABLE public.checklist_nonconformity_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checklist_nonconformity_parts"
  ON public.checklist_nonconformity_parts FOR SELECT
  USING (true);

CREATE POLICY "Admins and coordinators can manage checklist_nonconformity_parts"
  ON public.checklist_nonconformity_parts FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- =============================================
-- 2) Atualizar tabela de consumo: trocar exec_action_id por exec_nonconformity_id
-- =============================================
-- Primeiro, remover constraint e índice antigos
ALTER TABLE public.preventive_part_consumption DROP CONSTRAINT IF EXISTS preventive_part_consumption_exec_action_id_fkey;
DROP INDEX IF EXISTS idx_preventive_part_consumption_exec_action_id;
ALTER TABLE public.preventive_part_consumption DROP CONSTRAINT IF EXISTS preventive_part_consumption_exec_action_id_part_id_key;

-- Renomear coluna
ALTER TABLE public.preventive_part_consumption RENAME COLUMN exec_action_id TO exec_nonconformity_id;

-- Adicionar nova FK
ALTER TABLE public.preventive_part_consumption 
  ADD CONSTRAINT preventive_part_consumption_exec_nonconformity_id_fkey 
  FOREIGN KEY (exec_nonconformity_id) REFERENCES public.preventive_checklist_item_nonconformities(id) ON DELETE CASCADE;

-- Recriar índice e constraint de unicidade
CREATE INDEX idx_preventive_part_consumption_exec_nc_id ON public.preventive_part_consumption(exec_nonconformity_id);
ALTER TABLE public.preventive_part_consumption ADD CONSTRAINT preventive_part_consumption_exec_nc_part_key UNIQUE(exec_nonconformity_id, part_id);