-- Função para listar responsáveis (técnicos de campo / consultores R+) do formulário de pedidos
-- SECURITY DEFINER: user_roles tem RLS restrito ao próprio usuário/admin, e o formulário
-- é usado por todos os papéis. Retorna apenas id e nome de usuários ativos.
CREATE OR REPLACE FUNCTION public.list_pedidos_responsaveis(p_role app_role)
RETURNS TABLE (user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, p.nome
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = p_role
    AND p.is_active = true
  ORDER BY p.nome
$$;

GRANT EXECUTE ON FUNCTION public.list_pedidos_responsaveis(app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_pedidos_responsaveis(app_role) FROM anon;