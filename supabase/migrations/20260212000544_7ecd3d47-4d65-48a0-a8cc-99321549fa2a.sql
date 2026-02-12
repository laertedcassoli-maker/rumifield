
-- 1. Atualizar funcao is_admin_or_coordinator para incluir novo perfil
CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'coordenador_rplus', 'coordenador_servicos', 'coordenador_logistica')
  )
$$;

-- 2. Adicionar policy para coordenadores/admin poderem atualizar pedidos
CREATE POLICY "Admins and coordinators can update pedidos"
ON public.pedidos FOR UPDATE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

-- 3. Inserir permissoes de menu para o novo perfil
INSERT INTO role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT 'coordenador_logistica', menu_key, menu_label, menu_group, 
  CASE WHEN menu_key IN ('pedidos', 'admin_envios', 'admin_permissoes', 'admin_config', 'admin_usuarios') THEN true ELSE false END
FROM role_menu_permissions
WHERE role = 'admin'
ON CONFLICT DO NOTHING;
