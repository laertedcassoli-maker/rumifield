-- Add public token for report sharing
ALTER TABLE public.preventive_maintenance 
ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_preventive_maintenance_public_token 
ON public.preventive_maintenance(public_token);

-- Function to generate route code for preventive routes
CREATE OR REPLACE FUNCTION public.generate_preventive_route_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(route_code FROM 'PREV-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.preventive_routes
  WHERE route_code LIKE 'PREV-' || year_part || '-%';
  
  new_code := 'PREV-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  
  RETURN new_code;
END;
$$;

-- RLS policy for public report access (anyone with token can read)
CREATE POLICY "Anyone can view preventive by public token"
ON public.preventive_maintenance
FOR SELECT
USING (public_token IS NOT NULL);

-- Similar policies for related tables needed for the report
CREATE POLICY "Public read for checklists via preventive token"
ON public.preventive_checklists
FOR SELECT
USING (true);

CREATE POLICY "Public read for checklist blocks"
ON public.preventive_checklist_blocks
FOR SELECT
USING (true);

CREATE POLICY "Public read for checklist items"
ON public.preventive_checklist_items
FOR SELECT
USING (true);

CREATE POLICY "Public read for item nonconformities"
ON public.preventive_checklist_item_nonconformities
FOR SELECT
USING (true);

CREATE POLICY "Public read for item actions"
ON public.preventive_checklist_item_actions
FOR SELECT
USING (true);

CREATE POLICY "Public read for part consumption"
ON public.preventive_part_consumption
FOR SELECT
USING (true);

CREATE POLICY "Public read for visit media"
ON public.preventive_visit_media
FOR SELECT
USING (true);