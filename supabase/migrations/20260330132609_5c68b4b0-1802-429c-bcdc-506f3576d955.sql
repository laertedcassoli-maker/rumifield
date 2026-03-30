ALTER TABLE public.preventive_routes
ADD CONSTRAINT preventive_routes_route_code_unique UNIQUE (route_code);