
-- 1) Enum
CREATE TYPE public.crm_visit_status AS ENUM ('planejada','em_andamento','concluida','cancelada');

-- 2) crm_visits
CREATE TABLE public.crm_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  status crm_visit_status NOT NULL DEFAULT 'planejada',
  planned_start_at TIMESTAMPTZ NULL,
  planned_end_at TIMESTAMPTZ NULL,
  checkin_at TIMESTAMPTZ NULL,
  checkin_lat NUMERIC NULL,
  checkin_lon NUMERIC NULL,
  checkout_at TIMESTAMPTZ NULL,
  checkout_lat NUMERIC NULL,
  checkout_lon NUMERIC NULL,
  route_id UUID NULL REFERENCES public.preventive_routes(id) ON DELETE SET NULL,
  objective TEXT NULL,
  summary TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) crm_checklist_rules
CREATE TABLE public.crm_checklist_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code product_code NOT NULL,
  checklist_template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_crm_checklist_rules ON public.crm_checklist_rules(product_code, checklist_template_id);

-- 4) crm_visit_checklists
CREATE TABLE public.crm_visit_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.crm_visits(id) ON DELETE CASCADE,
  checklist_template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  product_code product_code NULL,
  origin TEXT NOT NULL DEFAULT 'auto',
  status checklist_execution_status NOT NULL DEFAULT 'em_andamento',
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Indexes
CREATE INDEX idx_crm_visits_client ON public.crm_visits(client_id);
CREATE INDEX idx_crm_visits_owner ON public.crm_visits(owner_user_id);
CREATE INDEX idx_crm_visits_route ON public.crm_visits(route_id);
CREATE INDEX idx_crm_visits_status ON public.crm_visits(status);
CREATE INDEX idx_crm_visit_checklists_visit ON public.crm_visit_checklists(visit_id);

-- 6) Updated_at trigger
CREATE TRIGGER update_crm_visits_updated_at
BEFORE UPDATE ON public.crm_visits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7) RLS crm_visits
ALTER TABLE public.crm_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_visits_select" ON public.crm_visits FOR SELECT USING (
  is_admin_or_coordinator(auth.uid())
  OR is_crm_client_owner(auth.uid(), client_id)
);
CREATE POLICY "crm_visits_insert" ON public.crm_visits FOR INSERT WITH CHECK (
  is_admin_or_coordinator(auth.uid())
  OR is_crm_client_owner(auth.uid(), client_id)
);
CREATE POLICY "crm_visits_update" ON public.crm_visits FOR UPDATE USING (
  is_admin_or_coordinator(auth.uid())
  OR is_crm_client_owner(auth.uid(), client_id)
);
CREATE POLICY "crm_visits_delete" ON public.crm_visits FOR DELETE USING (
  is_admin_or_coordinator(auth.uid())
);

-- 8) RLS crm_checklist_rules
ALTER TABLE public.crm_checklist_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_checklist_rules_select" ON public.crm_checklist_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "crm_checklist_rules_admin" ON public.crm_checklist_rules FOR ALL USING (is_admin_or_coordinator(auth.uid()));

-- 9) RLS crm_visit_checklists
ALTER TABLE public.crm_visit_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_visit_checklists_select" ON public.crm_visit_checklists FOR SELECT USING (
  is_admin_or_coordinator(auth.uid())
  OR EXISTS (SELECT 1 FROM public.crm_visits v WHERE v.id = visit_id AND is_crm_client_owner(auth.uid(), v.client_id))
);
CREATE POLICY "crm_visit_checklists_insert" ON public.crm_visit_checklists FOR INSERT WITH CHECK (
  is_admin_or_coordinator(auth.uid())
  OR EXISTS (SELECT 1 FROM public.crm_visits v WHERE v.id = visit_id AND is_crm_client_owner(auth.uid(), v.client_id))
);
CREATE POLICY "crm_visit_checklists_update" ON public.crm_visit_checklists FOR UPDATE USING (
  is_admin_or_coordinator(auth.uid())
  OR EXISTS (SELECT 1 FROM public.crm_visits v WHERE v.id = visit_id AND is_crm_client_owner(auth.uid(), v.client_id))
);
