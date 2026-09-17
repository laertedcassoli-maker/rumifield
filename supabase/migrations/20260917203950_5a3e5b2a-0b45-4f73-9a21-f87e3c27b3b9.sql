-- Módulo Instalações (pré-venda / pré-instalação / instalação)
-- Caminho de execução de checklist paralelo ao preventivo: reaproveita
-- checklist_templates/blocks/items via FK, sem tocar em preventive_maintenance
-- nem em preventive_checklists.
--
-- RLS: seguindo a filosofia já documentada em supabase/migrations/CLAUDE.md para
-- tabelas operacionais, a LEITURA é ampla para authenticated (USING(true)), pois
-- todo o time operacional precisa enxergar o processo de instalação dos clientes.
-- A ESCRITA de gestão fica restrita a is_admin_or_coordinator(); além disso, o
-- técnico designado (technician_user_id = auth.uid()) pode atualizar a própria
-- etapa e criar/atualizar a execução de checklist dessa etapa.

CREATE TABLE public.installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  status TEXT NOT NULL DEFAULT 'em_andamento',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installations TO authenticated;
GRANT ALL ON public.installations TO service_role;

ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installations"
ON public.installations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and coordinators can manage installations"
ON public.installations FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE TRIGGER update_installations_updated_at
BEFORE UPDATE ON public.installations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_installations_cliente_id ON public.installations(cliente_id);

-- Etapas: no máximo uma de cada tipo por instalação
CREATE TABLE public.installation_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES public.installations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('pre_venda','pre_instalacao','instalacao')),
  status TEXT NOT NULL DEFAULT 'planejado',
  technician_user_id UUID REFERENCES auth.users(id),
  planned_date DATE,
  checklist_template_id UUID REFERENCES public.checklist_templates(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (installation_id, stage)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_stages TO authenticated;
GRANT ALL ON public.installation_stages TO service_role;

ALTER TABLE public.installation_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation_stages"
ON public.installation_stages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and coordinators can manage installation_stages"
ON public.installation_stages FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- Técnico designado atualiza a própria etapa (status/execução), sem poder reatribuí-la
CREATE POLICY "Technicians can update own installation_stages"
ON public.installation_stages FOR UPDATE
TO authenticated
USING (technician_user_id = auth.uid())
WITH CHECK (technician_user_id = auth.uid());

CREATE TRIGGER update_installation_stages_updated_at
BEFORE UPDATE ON public.installation_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_installation_stages_installation_id ON public.installation_stages(installation_id);
CREATE INDEX idx_installation_stages_technician ON public.installation_stages(technician_user_id);

-- Execução de checklist da etapa (espelha preventive_checklists, mas ligada à etapa)
CREATE TABLE public.installation_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_stage_id UUID NOT NULL REFERENCES public.installation_stages(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id),
  status checklist_execution_status NOT NULL DEFAULT 'em_andamento',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_checklists TO authenticated;
GRANT ALL ON public.installation_checklists TO service_role;

ALTER TABLE public.installation_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation_checklists"
ON public.installation_checklists FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and coordinators can manage installation_checklists"
ON public.installation_checklists FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Technicians can insert own installation_checklists"
ON public.installation_checklists FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.installation_stages s
    WHERE s.id = installation_checklists.installation_stage_id
      AND s.technician_user_id = auth.uid()
  )
);

CREATE POLICY "Technicians can update own installation_checklists"
ON public.installation_checklists FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.installation_stages s
    WHERE s.id = installation_checklists.installation_stage_id
      AND s.technician_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.installation_stages s
    WHERE s.id = installation_checklists.installation_stage_id
      AND s.technician_user_id = auth.uid()
  )
);

CREATE INDEX idx_installation_checklists_stage_id ON public.installation_checklists(installation_stage_id);