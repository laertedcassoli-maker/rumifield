ALTER VIEW public.client_preventive_overview SET (security_invoker = true);

GRANT SELECT ON public.client_preventive_overview TO authenticated;
GRANT SELECT ON public.client_preventive_overview TO service_role;