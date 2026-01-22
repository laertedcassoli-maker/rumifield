-- 1. Add preventive_frequency_days to clientes table
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS preventive_frequency_days integer;

-- 2. Create enum for preventive maintenance status
CREATE TYPE preventive_maintenance_status AS ENUM ('planejada', 'concluida', 'cancelada');

-- 3. Create enum for preventive route status
CREATE TYPE preventive_route_status AS ENUM ('planejada', 'em_execucao', 'finalizada');

-- 4. Create enum for preventive route item status
CREATE TYPE preventive_route_item_status AS ENUM ('planejado', 'executado', 'reagendado', 'cancelado');

-- 5. Create preventive_maintenance table (execution records)
CREATE TABLE public.preventive_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  completed_date date,
  status preventive_maintenance_status NOT NULL DEFAULT 'planejada',
  technician_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT completed_date_required_when_concluida CHECK (
    (status != 'concluida') OR (status = 'concluida' AND completed_date IS NOT NULL)
  )
);

-- 6. Create preventive_routes table (route planning)
CREATE TABLE public.preventive_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_code text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status preventive_route_status NOT NULL DEFAULT 'planejada',
  field_technician_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 7. Create preventive_route_items table (route-to-client relationship)
CREATE TABLE public.preventive_route_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.preventive_routes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  suggested_reason text,
  planned_date date,
  status preventive_route_item_status NOT NULL DEFAULT 'planejado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_per_route UNIQUE (route_id, client_id)
);

-- 8. Create indexes for performance
CREATE INDEX idx_preventive_maintenance_client ON public.preventive_maintenance(client_id);
CREATE INDEX idx_preventive_maintenance_status ON public.preventive_maintenance(status);
CREATE INDEX idx_preventive_maintenance_completed ON public.preventive_maintenance(completed_date) WHERE status = 'concluida';
CREATE INDEX idx_preventive_routes_technician ON public.preventive_routes(field_technician_user_id);
CREATE INDEX idx_preventive_routes_status ON public.preventive_routes(status);
CREATE INDEX idx_preventive_route_items_route ON public.preventive_route_items(route_id);
CREATE INDEX idx_preventive_route_items_client ON public.preventive_route_items(client_id);

-- 9. Create trigger for updated_at
CREATE TRIGGER update_preventive_maintenance_updated_at
  BEFORE UPDATE ON public.preventive_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_preventive_routes_updated_at
  BEFORE UPDATE ON public.preventive_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_preventive_route_items_updated_at
  BEFORE UPDATE ON public.preventive_route_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 10. Enable RLS on all new tables
ALTER TABLE public.preventive_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_route_items ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for preventive_maintenance
CREATE POLICY "Authenticated users can read preventive_maintenance"
ON public.preventive_maintenance FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and coordinators can insert preventive_maintenance"
ON public.preventive_maintenance FOR INSERT TO authenticated
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins and coordinators can update preventive_maintenance"
ON public.preventive_maintenance FOR UPDATE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins and coordinators can delete preventive_maintenance"
ON public.preventive_maintenance FOR DELETE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

-- 12. RLS Policies for preventive_routes
CREATE POLICY "Authenticated users can read preventive_routes"
ON public.preventive_routes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and coordinators can insert preventive_routes"
ON public.preventive_routes FOR INSERT TO authenticated
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins and coordinators can update preventive_routes"
ON public.preventive_routes FOR UPDATE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins and coordinators can delete preventive_routes"
ON public.preventive_routes FOR DELETE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

-- 13. RLS Policies for preventive_route_items
CREATE POLICY "Authenticated users can read preventive_route_items"
ON public.preventive_route_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and coordinators can insert preventive_route_items"
ON public.preventive_route_items FOR INSERT TO authenticated
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins and coordinators can update preventive_route_items"
ON public.preventive_route_items FOR UPDATE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins and coordinators can delete preventive_route_items"
ON public.preventive_route_items FOR DELETE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

-- 14. Create a function to get client preventive status
CREATE OR REPLACE FUNCTION public.get_client_preventive_status(
  p_client_id uuid,
  p_frequency_days integer
)
RETURNS TABLE (
  last_preventive_date date,
  days_since_last integer,
  days_until_due integer,
  preventive_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date date;
  v_days_since integer;
  v_days_until integer;
BEGIN
  -- Get the last completed preventive date
  SELECT MAX(pm.completed_date) INTO v_last_date
  FROM preventive_maintenance pm
  WHERE pm.client_id = p_client_id AND pm.status = 'concluida';
  
  IF v_last_date IS NULL THEN
    RETURN QUERY SELECT 
      NULL::date,
      NULL::integer,
      NULL::integer,
      'sem_historico'::text;
  ELSE
    v_days_since := CURRENT_DATE - v_last_date;
    v_days_until := COALESCE(p_frequency_days, 90) - v_days_since;
    
    RETURN QUERY SELECT 
      v_last_date,
      v_days_since,
      v_days_until,
      CASE
        WHEN v_days_until < 0 THEN 'atrasada'
        WHEN v_days_until <= 30 THEN 'elegivel'
        ELSE 'em_dia'
      END::text;
  END IF;
END;
$$;

-- 15. Create a view for easier querying of client preventive status
CREATE OR REPLACE VIEW public.client_preventive_overview AS
SELECT 
  c.id as client_id,
  c.nome as client_name,
  c.fazenda,
  c.preventive_frequency_days,
  c.consultor_rplus_id,
  (SELECT MAX(pm.completed_date) 
   FROM preventive_maintenance pm 
   WHERE pm.client_id = c.id AND pm.status = 'concluida') as last_preventive_date,
  CASE 
    WHEN (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida') IS NULL 
    THEN NULL
    ELSE CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida')
  END as days_since_last,
  CASE 
    WHEN (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida') IS NULL 
    THEN NULL
    ELSE COALESCE(c.preventive_frequency_days, 90) - (CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida'))
  END as days_until_due,
  CASE 
    WHEN (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida') IS NULL 
    THEN 'sem_historico'
    WHEN COALESCE(c.preventive_frequency_days, 90) - (CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida')) < 0 
    THEN 'atrasada'
    WHEN COALESCE(c.preventive_frequency_days, 90) - (CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida')) <= 30 
    THEN 'elegivel'
    ELSE 'em_dia'
  END as preventive_status
FROM clientes c
WHERE c.status = 'ativo';