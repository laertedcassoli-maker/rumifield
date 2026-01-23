-- Add 'em_elaboracao' to the preventive_route_status enum
ALTER TYPE public.preventive_route_status ADD VALUE IF NOT EXISTS 'em_elaboracao' BEFORE 'planejada';