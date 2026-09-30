REVOKE EXECUTE ON FUNCTION public.can_cancel_work_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cancel_work_order(uuid) TO authenticated, service_role;