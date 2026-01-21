-- Enum for execution type
CREATE TYPE public.execution_type AS ENUM ('UNIVOCA', 'LOTE');

-- Enum for work order status
CREATE TYPE public.work_order_status AS ENUM ('aguardando', 'em_manutencao', 'concluido');

-- Enum for time entry status
CREATE TYPE public.time_entry_status AS ENUM ('running', 'paused', 'finished');

-- Enum for meter type
CREATE TYPE public.meter_type AS ENUM ('horimetro');

-- ============================================
-- ACTIVITIES (Atividades de oficina)
-- ============================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  execution_type public.execution_type NOT NULL DEFAULT 'UNIVOCA',
  requires_unique_item BOOLEAN NOT NULL DEFAULT true,
  allows_quantity BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and coordinators can manage activities"
  ON public.activities FOR ALL
  TO authenticated
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- ============================================
-- ACTIVITY_PRODUCTS (Relacionamento atividade <-> produto Omie)
-- ============================================
CREATE TABLE public.activity_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  omie_product_id UUID NOT NULL REFERENCES public.pecas(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  requires_meter_hours BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(activity_id, omie_product_id)
);

ALTER TABLE public.activity_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activity_products"
  ON public.activity_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and coordinators can manage activity_products"
  ON public.activity_products FOR ALL
  TO authenticated
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- ============================================
-- WORKSHOP_ITEMS (Itens únicos de oficina - ativos físicos)
-- ============================================
CREATE TABLE public.workshop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_code TEXT NOT NULL UNIQUE,
  omie_product_id UUID NOT NULL REFERENCES public.pecas(id) ON DELETE RESTRICT,
  meter_hours_last NUMERIC NULL,
  meter_hours_updated_at TIMESTAMPTZ NULL,
  status TEXT DEFAULT 'disponivel',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workshop_items"
  ON public.workshop_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and coordinators can manage workshop_items"
  ON public.workshop_items FOR ALL
  TO authenticated
  USING (is_admin_or_coordinator(auth.uid()))
  WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- ============================================
-- WORK_ORDERS (Ordens de Serviço)
-- ============================================
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
  status public.work_order_status NOT NULL DEFAULT 'aguardando',
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_time_seconds INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMPTZ NULL,
  end_time TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read work_orders"
  ON public.work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert work_orders"
  ON public.work_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update assigned work_orders"
  ON public.work_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = assigned_to_user_id OR is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins can delete work_orders"
  ON public.work_orders FOR DELETE
  TO authenticated
  USING (is_admin_or_coordinator(auth.uid()));

-- ============================================
-- WORK_ORDER_ITEMS (Itens da OS)
-- ============================================
CREATE TABLE public.work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  workshop_item_id UUID REFERENCES public.workshop_items(id) ON DELETE RESTRICT,
  omie_product_id UUID REFERENCES public.pecas(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  meter_hours_entry NUMERIC NULL,
  meter_hours_exit NUMERIC NULL,
  status TEXT DEFAULT 'pendente',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_item_or_product CHECK (workshop_item_id IS NOT NULL OR omie_product_id IS NOT NULL)
);

ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read work_order_items"
  ON public.work_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage work_order_items"
  ON public.work_order_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- WORK_ORDER_TIME_ENTRIES (Cronômetro)
-- ============================================
CREATE TABLE public.work_order_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  duration_seconds INTEGER NULL,
  status public.time_entry_status NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read time_entries"
  ON public.work_order_time_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own time_entries"
  ON public.work_order_time_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- WORK_ORDER_PARTS_USED (Peças consumidas)
-- ============================================
CREATE TABLE public.work_order_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  omie_product_id UUID NOT NULL REFERENCES public.pecas(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT NULL,
  added_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_parts_used ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read parts_used"
  ON public.work_order_parts_used FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage parts_used"
  ON public.work_order_parts_used FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ASSET_METER_READINGS (Histórico de horímetro)
-- ============================================
CREATE TABLE public.asset_meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_item_id UUID NOT NULL REFERENCES public.workshop_items(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  meter_type public.meter_type NOT NULL DEFAULT 'horimetro',
  reading_value NUMERIC NOT NULL,
  reading_unit TEXT NOT NULL DEFAULT 'horas',
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read meter_readings"
  ON public.asset_meter_readings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert meter_readings"
  ON public.asset_meter_readings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_workshop_items_updated_at
  BEFORE UPDATE ON public.workshop_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- FUNCTION: Generate work order code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_work_order_code()
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
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'OS-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.work_orders
  WHERE code LIKE 'OS-' || year_part || '-%';
  
  new_code := 'OS-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  
  RETURN new_code;
END;
$$;

-- ============================================
-- FUNCTION: Validate meter hours on update
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_meter_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Check if new value is less than last recorded value
  IF NEW.meter_hours_last IS NOT NULL AND OLD.meter_hours_last IS NOT NULL THEN
    IF NEW.meter_hours_last < OLD.meter_hours_last THEN
      -- Only allow if user is admin/coordinator (they can override)
      IF NOT is_admin_or_coordinator(auth.uid()) THEN
        RAISE EXCEPTION 'Novo horímetro (%) não pode ser menor que o último valor registrado (%). Contate um administrador.', 
          NEW.meter_hours_last, OLD.meter_hours_last;
      END IF;
    END IF;
  END IF;
  
  NEW.meter_hours_updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_workshop_item_meter_hours
  BEFORE UPDATE OF meter_hours_last ON public.workshop_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meter_hours();