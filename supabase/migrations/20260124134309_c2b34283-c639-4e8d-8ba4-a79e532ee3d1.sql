-- Add visit_code to ticket_visits for CORR-YYYY-NNNNN pattern
ALTER TABLE public.ticket_visits 
ADD COLUMN IF NOT EXISTS visit_code TEXT;

-- Create function to generate corrective visit code
CREATE OR REPLACE FUNCTION public.generate_corrective_visit_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  new_code TEXT;
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(visit_code FROM 'CORR-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.ticket_visits
  WHERE visit_code LIKE 'CORR-' || year_part || '-%';
  
  new_code := 'CORR-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  
  RETURN new_code;
END;
$function$;

-- Create trigger to auto-generate visit_code on insert
CREATE OR REPLACE FUNCTION public.set_corrective_visit_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.visit_code IS NULL THEN
    NEW.visit_code := generate_corrective_visit_code();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_set_corrective_visit_code
BEFORE INSERT ON public.ticket_visits
FOR EACH ROW
EXECUTE FUNCTION public.set_corrective_visit_code();

-- Add corrective_maintenance table for checklist execution on corrective visits
CREATE TABLE IF NOT EXISTS public.corrective_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.ticket_visits(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clientes(id),
  checklist_template_id UUID REFERENCES public.checklist_templates(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  checkin_at TIMESTAMPTZ,
  checkin_lat DOUBLE PRECISION,
  checkin_lon DOUBLE PRECISION,
  checkout_at TIMESTAMPTZ,
  checkout_lat DOUBLE PRECISION,
  checkout_lon DOUBLE PRECISION,
  notes TEXT,
  public_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(visit_id)
);

-- Enable RLS
ALTER TABLE public.corrective_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS policies for corrective_maintenance
CREATE POLICY "Users can view corrective maintenance"
ON public.corrective_maintenance FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert corrective maintenance"
ON public.corrective_maintenance FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update corrective maintenance"
ON public.corrective_maintenance FOR UPDATE
TO authenticated
USING (true);

-- Add menu permissions for "Minhas Rotas" at principal level
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access) VALUES
('admin', 'minhas_rotas', 'Minhas Rotas', 'principal', true),
('coordenador_rplus', 'minhas_rotas', 'Minhas Rotas', 'principal', false),
('consultor_rplus', 'minhas_rotas', 'Minhas Rotas', 'principal', false),
('coordenador_servicos', 'minhas_rotas', 'Minhas Rotas', 'principal', true),
('tecnico_campo', 'minhas_rotas', 'Minhas Rotas', 'principal', true),
('tecnico_oficina', 'minhas_rotas', 'Minhas Rotas', 'principal', false)
ON CONFLICT (role, menu_key) DO UPDATE SET can_access = EXCLUDED.can_access;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_visits_visit_code ON public.ticket_visits(visit_code);
CREATE INDEX IF NOT EXISTS idx_corrective_maintenance_visit_id ON public.corrective_maintenance(visit_id);
CREATE INDEX IF NOT EXISTS idx_corrective_maintenance_public_token ON public.corrective_maintenance(public_token);