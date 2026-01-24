-- =============================================
-- MÓDULO CHAMADOS TÉCNICOS - SCHEMA COMPLETO
-- =============================================

-- 1) Enum para status do ticket
CREATE TYPE public.ticket_status AS ENUM (
  'aberto',
  'em_atendimento',
  'aguardando_peca',
  'resolvido',
  'cancelado'
);

-- 2) Enum para prioridade do ticket
CREATE TYPE public.ticket_priority AS ENUM (
  'baixa',
  'media',
  'alta',
  'urgente'
);

-- 3) Enum para status da visita corretiva
CREATE TYPE public.ticket_visit_status AS ENUM (
  'em_elaboracao',
  'planejada',
  'em_execucao',
  'finalizada',
  'cancelada'
);

-- 4) Enum para resultado da visita
CREATE TYPE public.visit_result AS ENUM (
  'resolvido',
  'parcial',
  'aguardando_peca'
);

-- =============================================
-- TABELA: technical_tickets (Chamados Técnicos)
-- =============================================
CREATE TABLE public.technical_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Dados do problema
  title TEXT NOT NULL,
  description TEXT,
  priority ticket_priority NOT NULL DEFAULT 'media',
  status ticket_status NOT NULL DEFAULT 'aberto',
  
  -- Resolução
  resolution_summary TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_technical_tickets_client ON public.technical_tickets(client_id);
CREATE INDEX idx_technical_tickets_status ON public.technical_tickets(status);
CREATE INDEX idx_technical_tickets_technician ON public.technical_tickets(assigned_technician_id);
CREATE INDEX idx_technical_tickets_created_at ON public.technical_tickets(created_at DESC);

-- Trigger para updated_at
CREATE TRIGGER update_technical_tickets_updated_at
  BEFORE UPDATE ON public.technical_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- TABELA: ticket_visits (Visitas Corretivas)
-- =============================================
CREATE TABLE public.ticket_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.technical_tickets(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  field_technician_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Status e planejamento
  status ticket_visit_status NOT NULL DEFAULT 'em_elaboracao',
  planned_start_date DATE,
  planned_end_date DATE,
  
  -- Checklist (reutiliza template de preventiva)
  checklist_template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  
  -- Check-in
  checkin_at TIMESTAMP WITH TIME ZONE,
  checkin_lat NUMERIC(10, 7),
  checkin_lon NUMERIC(10, 7),
  
  -- Check-out
  checkout_at TIMESTAMP WITH TIME ZONE,
  checkout_lat NUMERIC(10, 7),
  checkout_lon NUMERIC(10, 7),
  
  -- Resultado
  result visit_result,
  visit_summary TEXT,
  
  -- Notas internas e públicas
  internal_notes TEXT,
  public_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ticket_visits_ticket ON public.ticket_visits(ticket_id);
CREATE INDEX idx_ticket_visits_technician ON public.ticket_visits(field_technician_user_id);
CREATE INDEX idx_ticket_visits_status ON public.ticket_visits(status);
CREATE INDEX idx_ticket_visits_planned_date ON public.ticket_visits(planned_start_date);

-- Trigger para updated_at
CREATE TRIGGER update_ticket_visits_updated_at
  BEFORE UPDATE ON public.ticket_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- TABELA: ticket_parts_requests (Vínculo Ticket <-> Pedido)
-- =============================================
CREATE TABLE public.ticket_parts_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.technical_tickets(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.ticket_visits(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(ticket_id, pedido_id)
);

CREATE INDEX idx_ticket_parts_requests_ticket ON public.ticket_parts_requests(ticket_id);
CREATE INDEX idx_ticket_parts_requests_pedido ON public.ticket_parts_requests(pedido_id);

-- =============================================
-- TABELA: ticket_timeline (Histórico de eventos)
-- =============================================
CREATE TABLE public.ticket_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.technical_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_timeline_ticket ON public.ticket_timeline(ticket_id);
CREATE INDEX idx_ticket_timeline_created_at ON public.ticket_timeline(created_at DESC);

-- =============================================
-- TABELA: ticket_visit_actions (Ações corretivas da visita)
-- =============================================
CREATE TABLE public.ticket_visit_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.ticket_visits(id) ON DELETE CASCADE,
  action_description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_visit_actions_visit ON public.ticket_visit_actions(visit_id);

-- =============================================
-- FUNÇÃO: Gerar código do ticket
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_code FROM 'CH-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.technical_tickets
  WHERE ticket_code LIKE 'CH-' || year_part || '-%';
  
  new_code := 'CH-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  
  RETURN new_code;
END;
$$;

-- =============================================
-- RLS: technical_tickets
-- =============================================
ALTER TABLE public.technical_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read technical_tickets"
  ON public.technical_tickets FOR SELECT
  USING (true);

CREATE POLICY "Admins and coordinators can manage technical_tickets"
  ON public.technical_tickets FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Users can create technical_tickets"
  ON public.technical_tickets FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Assigned technicians can update their tickets"
  ON public.technical_tickets FOR UPDATE
  USING (auth.uid() = assigned_technician_id);

-- =============================================
-- RLS: ticket_visits
-- =============================================
ALTER TABLE public.ticket_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_visits"
  ON public.ticket_visits FOR SELECT
  USING (true);

CREATE POLICY "Admins and coordinators can manage ticket_visits"
  ON public.ticket_visits FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Technicians can update their assigned visits"
  ON public.ticket_visits FOR UPDATE
  USING (auth.uid() = field_technician_user_id);

-- =============================================
-- RLS: ticket_parts_requests
-- =============================================
ALTER TABLE public.ticket_parts_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_parts_requests"
  ON public.ticket_parts_requests FOR SELECT
  USING (true);

CREATE POLICY "Users can insert ticket_parts_requests with their pedidos"
  ON public.ticket_parts_requests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pedidos WHERE id = pedido_id AND solicitante_id = auth.uid()
  ));

CREATE POLICY "Admins and coordinators can manage ticket_parts_requests"
  ON public.ticket_parts_requests FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- =============================================
-- RLS: ticket_timeline
-- =============================================
ALTER TABLE public.ticket_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_timeline"
  ON public.ticket_timeline FOR SELECT
  USING (true);

CREATE POLICY "Users can insert ticket_timeline entries"
  ON public.ticket_timeline FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage ticket_timeline"
  ON public.ticket_timeline FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- =============================================
-- RLS: ticket_visit_actions
-- =============================================
ALTER TABLE public.ticket_visit_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_visit_actions"
  ON public.ticket_visit_actions FOR SELECT
  USING (true);

CREATE POLICY "Technicians can manage actions on their visits"
  ON public.ticket_visit_actions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM ticket_visits tv
    WHERE tv.id = visit_id AND tv.field_technician_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM ticket_visits tv
    WHERE tv.id = visit_id AND tv.field_technician_user_id = auth.uid()
  ));

CREATE POLICY "Admins and coordinators can manage ticket_visit_actions"
  ON public.ticket_visit_actions FOR ALL
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));