REVOKE EXECUTE ON FUNCTION public.list_pedidos_responsaveis(app_role) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_pedidos_responsaveis(app_role) TO authenticated;