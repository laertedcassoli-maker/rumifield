-- Add route_id column to preventive_maintenance to link directly to the route
ALTER TABLE public.preventive_maintenance 
ADD COLUMN route_id UUID REFERENCES public.preventive_routes(id) ON DELETE SET NULL;

-- Create unique constraint: only 1 checklist per client per route
-- Using a partial unique index to allow nulls (for legacy records without route_id)
CREATE UNIQUE INDEX unique_client_route_preventive 
ON public.preventive_maintenance (client_id, route_id) 
WHERE route_id IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX idx_preventive_maintenance_route_id 
ON public.preventive_maintenance(route_id);