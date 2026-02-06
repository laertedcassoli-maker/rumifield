
-- ============================================================
-- CRM Expansion Module - Core Schema
-- ============================================================

-- 1) ENUMS
CREATE TYPE public.product_code AS ENUM ('ideagri','rumiflow','onfarm','rumiaction','insights');
CREATE TYPE public.crm_stage AS ENUM ('nao_qualificado','qualificado','proposta','negociacao','ganho','perdido','descartado');
CREATE TYPE public.proposal_status AS ENUM ('ativa','expirada','aceita','recusada');
CREATE TYPE public.action_status AS ENUM ('aberta','em_execucao','concluida');
CREATE TYPE public.action_type AS ENUM ('tarefa','pendencia','oportunidade');

-- 2A) crm_client_products
CREATE TABLE public.crm_client_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  product_code product_code NOT NULL,
  stage crm_stage NOT NULL DEFAULT 'nao_qualificado',
  stage_updated_at timestamptz NOT NULL DEFAULT now(),
  owner_user_id uuid NOT NULL,
  value_estimated numeric NULL,
  probability int NULL,
  notes text NULL,
  loss_reason_id uuid NULL,
  loss_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, product_code)
);

-- 2B) crm_product_qualification_templates
CREATE TABLE public.crm_product_qualification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code product_code NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- 2C) crm_product_qualification_items
CREATE TABLE public.crm_product_qualification_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.crm_product_qualification_templates(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);

-- 2D) crm_client_product_qualification_answers
CREATE TABLE public.crm_client_product_qualification_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id uuid NOT NULL REFERENCES public.crm_client_products(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.crm_product_qualification_items(id) ON DELETE CASCADE,
  answer_text text NULL,
  answer_number numeric NULL,
  answer_date date NULL,
  answer_boolean boolean NULL,
  answer_choice text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  UNIQUE (client_product_id, item_id)
);

-- 2E) crm_loss_reasons
CREATE TABLE public.crm_loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code product_code NOT NULL,
  reason text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

-- FK from crm_client_products.loss_reason_id
ALTER TABLE public.crm_client_products
  ADD CONSTRAINT crm_client_products_loss_reason_id_fkey
  FOREIGN KEY (loss_reason_id) REFERENCES public.crm_loss_reasons(id) ON DELETE SET NULL;

-- 2F) crm_proposals
CREATE TABLE public.crm_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id uuid NOT NULL REFERENCES public.crm_client_products(id) ON DELETE CASCADE,
  status proposal_status NOT NULL DEFAULT 'ativa',
  sent_at timestamptz NULL,
  valid_until date NULL,
  proposed_value numeric NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- 2G) crm_actions
CREATE TABLE public.crm_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  client_product_id uuid NULL REFERENCES public.crm_client_products(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NULL,
  type action_type NOT NULL DEFAULT 'tarefa',
  status action_status NOT NULL DEFAULT 'aberta',
  priority int NOT NULL DEFAULT 3,
  due_at timestamptz NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- 2H) crm_metric_definitions
CREATE TABLE public.crm_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code product_code NOT NULL,
  metric_key text NOT NULL,
  label text NOT NULL,
  value_type text NOT NULL DEFAULT 'text',
  unit text NULL,
  group_name text NULL,
  priority int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (product_code, metric_key)
);

-- 2I) crm_client_product_snapshots
CREATE TABLE public.crm_client_product_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  product_code product_code NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_status text NULL,
  health_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (client_id, product_code)
);

-- ============================================================
-- 3) RLS
-- ============================================================

-- Helper: check if user is consultant for a client
CREATE OR REPLACE FUNCTION public.is_crm_client_owner(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = _client_id AND consultor_rplus_id = _user_id
  )
$$;

-- Enable RLS on all CRM tables
ALTER TABLE public.crm_client_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_product_qualification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_product_qualification_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_client_product_qualification_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_client_product_snapshots ENABLE ROW LEVEL SECURITY;

-- crm_client_products
CREATE POLICY "Admins full access crm_client_products" ON public.crm_client_products FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Consultants read own crm_client_products" ON public.crm_client_products FOR SELECT
  USING (is_crm_client_owner(auth.uid(), client_id));
CREATE POLICY "Consultants update own crm_client_products" ON public.crm_client_products FOR UPDATE
  USING (is_crm_client_owner(auth.uid(), client_id));

-- crm_product_qualification_templates (catalog - read all, manage admins)
CREATE POLICY "Auth read qual_templates" ON public.crm_product_qualification_templates FOR SELECT USING (true);
CREATE POLICY "Admins manage qual_templates" ON public.crm_product_qualification_templates FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- crm_product_qualification_items (catalog)
CREATE POLICY "Auth read qual_items" ON public.crm_product_qualification_items FOR SELECT USING (true);
CREATE POLICY "Admins manage qual_items" ON public.crm_product_qualification_items FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- crm_client_product_qualification_answers
CREATE POLICY "Admins full access qual_answers" ON public.crm_client_product_qualification_answers FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Consultants read own qual_answers" ON public.crm_client_product_qualification_answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_client_products cp WHERE cp.id = client_product_id AND is_crm_client_owner(auth.uid(), cp.client_id)));
CREATE POLICY "Consultants upsert own qual_answers" ON public.crm_client_product_qualification_answers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM crm_client_products cp WHERE cp.id = client_product_id AND is_crm_client_owner(auth.uid(), cp.client_id)));
CREATE POLICY "Consultants update own qual_answers" ON public.crm_client_product_qualification_answers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM crm_client_products cp WHERE cp.id = client_product_id AND is_crm_client_owner(auth.uid(), cp.client_id)));

-- crm_loss_reasons (catalog)
CREATE POLICY "Auth read loss_reasons" ON public.crm_loss_reasons FOR SELECT USING (true);
CREATE POLICY "Admins manage loss_reasons" ON public.crm_loss_reasons FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- crm_proposals
CREATE POLICY "Admins full access proposals" ON public.crm_proposals FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Consultants read own proposals" ON public.crm_proposals FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_client_products cp WHERE cp.id = client_product_id AND is_crm_client_owner(auth.uid(), cp.client_id)));
CREATE POLICY "Consultants insert own proposals" ON public.crm_proposals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM crm_client_products cp WHERE cp.id = client_product_id AND is_crm_client_owner(auth.uid(), cp.client_id)));
CREATE POLICY "Consultants update own proposals" ON public.crm_proposals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM crm_client_products cp WHERE cp.id = client_product_id AND is_crm_client_owner(auth.uid(), cp.client_id)));

-- crm_actions
CREATE POLICY "Admins full access actions" ON public.crm_actions FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Consultants read own actions" ON public.crm_actions FOR SELECT
  USING (is_crm_client_owner(auth.uid(), client_id));
CREATE POLICY "Consultants insert own actions" ON public.crm_actions FOR INSERT
  WITH CHECK (is_crm_client_owner(auth.uid(), client_id));
CREATE POLICY "Consultants update own actions" ON public.crm_actions FOR UPDATE
  USING (is_crm_client_owner(auth.uid(), client_id));

-- crm_metric_definitions (catalog)
CREATE POLICY "Auth read metric_defs" ON public.crm_metric_definitions FOR SELECT USING (true);
CREATE POLICY "Admins manage metric_defs" ON public.crm_metric_definitions FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- crm_client_product_snapshots
CREATE POLICY "Admins full access snapshots" ON public.crm_client_product_snapshots FOR ALL
  USING (is_admin_or_coordinator(auth.uid())) WITH CHECK (is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Consultants read own snapshots" ON public.crm_client_product_snapshots FOR SELECT
  USING (is_crm_client_owner(auth.uid(), client_id));

-- ============================================================
-- 4) TRIGGER: auto-create 5 products on new client
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_crm_products_for_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crm_client_products (client_id, product_code, owner_user_id)
  SELECT NEW.id, p.code, COALESCE(NEW.consultor_rplus_id, '00000000-0000-0000-0000-000000000000')
  FROM (VALUES ('ideagri'::product_code),('rumiflow'::product_code),('onfarm'::product_code),('rumiaction'::product_code),('insights'::product_code)) AS p(code)
  ON CONFLICT (client_id, product_code) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_crm_products_for_client
AFTER INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.create_crm_products_for_client();

-- ============================================================
-- 5) SEEDS: Loss reasons, qualification templates, metric definitions
-- ============================================================

-- Loss reasons (6 per product x 5 products = 30)
INSERT INTO public.crm_loss_reasons (product_code, reason, sort_order) VALUES
  ('ideagri','Preço',1),('ideagri','Contrato vigente com concorrente',2),('ideagri','Concorrente preferido',3),('ideagri','Timing inadequado',4),('ideagri','Não vê valor',5),('ideagri','Outro',6),
  ('rumiflow','Preço',1),('rumiflow','Contrato vigente com concorrente',2),('rumiflow','Concorrente preferido',3),('rumiflow','Timing inadequado',4),('rumiflow','Não vê valor',5),('rumiflow','Outro',6),
  ('onfarm','Preço',1),('onfarm','Contrato vigente com concorrente',2),('onfarm','Concorrente preferido',3),('onfarm','Timing inadequado',4),('onfarm','Não vê valor',5),('onfarm','Outro',6),
  ('rumiaction','Preço',1),('rumiaction','Contrato vigente com concorrente',2),('rumiaction','Concorrente preferido',3),('rumiaction','Timing inadequado',4),('rumiaction','Não vê valor',5),('rumiaction','Outro',6),
  ('insights','Preço',1),('insights','Contrato vigente com concorrente',2),('insights','Concorrente preferido',3),('insights','Timing inadequado',4),('insights','Não vê valor',5),('insights','Outro',6);

-- Qualification templates (1 per product)
INSERT INTO public.crm_product_qualification_templates (id, product_code, name) VALUES
  ('a0000001-0000-0000-0000-000000000001','ideagri','Qualificação Ideagri'),
  ('a0000001-0000-0000-0000-000000000002','rumiflow','Qualificação RumiFlow'),
  ('a0000001-0000-0000-0000-000000000003','onfarm','Qualificação OnFarm'),
  ('a0000001-0000-0000-0000-000000000004','rumiaction','Qualificação RumiAction'),
  ('a0000001-0000-0000-0000-000000000005','insights','Qualificação Insights');

-- Qualification items (5 per template)
INSERT INTO public.crm_product_qualification_items (template_id, question, answer_type, is_required, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001','Qual software de gestão utiliza atualmente?','text',true,1),
  ('a0000001-0000-0000-0000-000000000001','Quantas vacas em lactação?','number',true,2),
  ('a0000001-0000-0000-0000-000000000001','Já utilizou Ideagri anteriormente?','boolean',false,3),
  ('a0000001-0000-0000-0000-000000000001','Tem interesse em integração com iMilk?','boolean',false,4),
  ('a0000001-0000-0000-0000-000000000001','Prazo esperado para decisão?','date',false,5),

  ('a0000001-0000-0000-0000-000000000002','Quantas ordenhas por dia?','number',true,1),
  ('a0000001-0000-0000-0000-000000000002','Possui automação de ordenha?','boolean',true,2),
  ('a0000001-0000-0000-0000-000000000002','Marca/modelo do equipamento?','text',false,3),
  ('a0000001-0000-0000-0000-000000000002','Já conhece o RumiFlow?','boolean',false,4),
  ('a0000001-0000-0000-0000-000000000002','Orçamento disponível?','choice',false,5),

  ('a0000001-0000-0000-0000-000000000003','Realiza análises de qualidade do leite?','boolean',true,1),
  ('a0000001-0000-0000-0000-000000000003','Frequência de análises atual?','choice',true,2),
  ('a0000001-0000-0000-0000-000000000003','Quantidade de amostras/mês?','number',false,3),
  ('a0000001-0000-0000-0000-000000000003','Laboratório utilizado?','text',false,4),
  ('a0000001-0000-0000-0000-000000000003','Principal dor com análises atuais?','text',false,5),

  ('a0000001-0000-0000-0000-000000000004','Quantos funcionários na fazenda?','number',true,1),
  ('a0000001-0000-0000-0000-000000000004','Utiliza algum app de gestão de tarefas?','boolean',true,2),
  ('a0000001-0000-0000-0000-000000000004','Principais dificuldades operacionais?','text',false,3),
  ('a0000001-0000-0000-0000-000000000004','Interesse em automação de protocolos?','boolean',false,4),
  ('a0000001-0000-0000-0000-000000000004','Prazo esperado para decisão?','date',false,5),

  ('a0000001-0000-0000-0000-000000000005','Já utiliza relatórios de indicadores?','boolean',true,1),
  ('a0000001-0000-0000-0000-000000000005','Quais indicadores acompanha hoje?','text',true,2),
  ('a0000001-0000-0000-0000-000000000005','Frequência de análise de dados?','choice',false,3),
  ('a0000001-0000-0000-0000-000000000005','Tem acesso a internet estável na fazenda?','boolean',false,4),
  ('a0000001-0000-0000-0000-000000000005','Orçamento mensal para ferramentas digitais?','number',false,5);

-- Metric definitions
INSERT INTO public.crm_metric_definitions (product_code, metric_key, label, value_type, unit, group_name, priority) VALUES
  ('ideagri','ideagri.plan_name','Plano','text',NULL,'Contrato',1),
  ('ideagri','ideagri.monthly_fee','Mensalidade','currency','BRL','Contrato',2),
  ('ideagri','ideagri.payment_status','Adimplência','status',NULL,'Contrato',3),
  ('ideagri','ideagri.integrations_status','Status Integrações','status',NULL,'Integrações',4),
  ('ideagri','ideagri.rumi_active_phones_7d','Celulares Ativos (7d)','number',NULL,'Uso',5),
  ('ideagri','ideagri.rumi_entries_7d','Lançamentos (7d)','number',NULL,'Uso',6),
  ('ideagri','ideagri.last_sync_at','Última Sincronia','date',NULL,'Integrações',7),
  ('ideagri','ideagri.total_animals','Total de Animais','number',NULL,'Uso',8),
  ('ideagri','ideagri.contract_start','Início Contrato','date',NULL,'Contrato',9),
  ('ideagri','ideagri.contract_end','Fim Contrato','date',NULL,'Contrato',10),

  ('onfarm','onfarm.contract_value','Valor Contrato','currency','BRL','Contrato',1),
  ('onfarm','onfarm.payment_status','Adimplência','status',NULL,'Contrato',2),
  ('onfarm','onfarm.tests_last_30d','Testes (30d)','number',NULL,'Uso',3),
  ('onfarm','onfarm.last_test_at','Último Teste','date',NULL,'Uso',4),
  ('onfarm','onfarm.total_samples','Total Amostras','number',NULL,'Uso',5),
  ('onfarm','onfarm.lab_name','Laboratório','text',NULL,'Integrações',6),
  ('onfarm','onfarm.active_protocols','Protocolos Ativos','number',NULL,'Uso',7),
  ('onfarm','onfarm.contract_start','Início Contrato','date',NULL,'Contrato',8),
  ('onfarm','onfarm.contract_end','Fim Contrato','date',NULL,'Contrato',9),
  ('onfarm','onfarm.avg_somatic_cells','CCS Média','number','mil/mL','Saúde',10),

  ('rumiflow','rumiflow.contract_value','Valor Contrato','currency','BRL','Contrato',1),
  ('rumiflow','rumiflow.payment_status','Adimplência','status',NULL,'Contrato',2),
  ('rumiflow','rumiflow.visits_last_60d','Visitas (60d)','number',NULL,'Uso',3),
  ('rumiflow','rumiflow.tickets_last_30d','Chamados (30d)','number',NULL,'Uso',4),
  ('rumiflow','rumiflow.equipment_model','Modelo Equipamento','text',NULL,'Integrações',5),
  ('rumiflow','rumiflow.milkings_per_day','Ordenhas/Dia','number',NULL,'Uso',6),
  ('rumiflow','rumiflow.activation_date','Data Ativação','date',NULL,'Contrato',7),
  ('rumiflow','rumiflow.contract_model','Modelo Contrato','text',NULL,'Contrato',8),
  ('rumiflow','rumiflow.pistol_count','Qtd Pistolas','number',NULL,'Integrações',9),
  ('rumiflow','rumiflow.last_preventive_at','Última Preventiva','date',NULL,'Saúde',10),

  ('insights','insights.plan_name','Plano','text',NULL,'Contrato',1),
  ('insights','insights.monthly_fee','Mensalidade','currency','BRL','Contrato',2),
  ('insights','insights.access_last_7d','Acessos (7d)','number',NULL,'Uso',3),
  ('insights','insights.reports_last_30d','Relatórios (30d)','number',NULL,'Uso',4),
  ('insights','insights.active_users','Usuários Ativos','number',NULL,'Uso',5),
  ('insights','insights.last_login_at','Último Login','date',NULL,'Uso',6),
  ('insights','insights.dashboards_count','Dashboards','number',NULL,'Uso',7),
  ('insights','insights.payment_status','Adimplência','status',NULL,'Contrato',8),
  ('insights','insights.contract_start','Início Contrato','date',NULL,'Contrato',9),
  ('insights','insights.data_sources','Fontes de Dados','number',NULL,'Integrações',10),

  ('rumiaction','rumiaction.active_users','Usuários Ativos','number',NULL,'Uso',1),
  ('rumiaction','rumiaction.events_last_30d','Eventos (30d)','number',NULL,'Uso',2),
  ('rumiaction','rumiaction.payment_status','Adimplência','status',NULL,'Contrato',3),
  ('rumiaction','rumiaction.protocols_active','Protocolos Ativos','number',NULL,'Uso',4),
  ('rumiaction','rumiaction.tasks_completed_30d','Tarefas Concluídas (30d)','number',NULL,'Uso',5),
  ('rumiaction','rumiaction.employees_count','Funcionários','number',NULL,'Uso',6),
  ('rumiaction','rumiaction.last_activity_at','Última Atividade','date',NULL,'Uso',7),
  ('rumiaction','rumiaction.contract_value','Valor Contrato','currency','BRL','Contrato',8),
  ('rumiaction','rumiaction.contract_start','Início Contrato','date',NULL,'Contrato',9),
  ('rumiaction','rumiaction.automation_level','Nível Automação','percent','%','Uso',10);

-- ============================================================
-- 6) Backfill: create CRM products for existing clients
-- ============================================================
INSERT INTO public.crm_client_products (client_id, product_code, owner_user_id)
SELECT c.id, p.code, COALESCE(c.consultor_rplus_id, '00000000-0000-0000-0000-000000000000')
FROM public.clientes c
CROSS JOIN (VALUES ('ideagri'::product_code),('rumiflow'::product_code),('onfarm'::product_code),('rumiaction'::product_code),('insights'::product_code)) AS p(code)
ON CONFLICT (client_id, product_code) DO NOTHING;
