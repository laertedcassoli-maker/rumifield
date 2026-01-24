-- Add base location fields to profiles table for technician route origin
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cidade_base TEXT,
ADD COLUMN IF NOT EXISTS cidade_base_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS cidade_base_lon DOUBLE PRECISION;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.cidade_base IS 'City name used as default origin for route planning';
COMMENT ON COLUMN public.profiles.cidade_base_lat IS 'Latitude of the base city';
COMMENT ON COLUMN public.profiles.cidade_base_lon IS 'Longitude of the base city';