-- Add check-in fields to preventive_route_items
ALTER TABLE public.preventive_route_items
ADD COLUMN checkin_at TIMESTAMPTZ,
ADD COLUMN checkin_lat DECIMAL(10, 6),
ADD COLUMN checkin_lon DECIMAL(10, 6);

-- Add comment for documentation
COMMENT ON COLUMN public.preventive_route_items.checkin_at IS 'Timestamp when field technician checked in at the farm';
COMMENT ON COLUMN public.preventive_route_items.checkin_lat IS 'Latitude captured during check-in';
COMMENT ON COLUMN public.preventive_route_items.checkin_lon IS 'Longitude captured during check-in';