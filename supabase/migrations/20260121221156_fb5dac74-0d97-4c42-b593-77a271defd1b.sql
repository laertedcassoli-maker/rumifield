-- Criar função helper para verificar se usuário é admin ou coordenador
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
      AND role IN ('admin', 'coordenador_rplus', 'coordenador_servicos')
  )
$$;

-- Dropar políticas antigas
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recriar política para user_roles: usuários veem próprio role, admins/coordenadores veem todos
CREATE POLICY "Users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.is_admin_or_coordinator(auth.uid())
);

-- Recriar política para profiles: usuários veem próprio perfil, admins/coordenadores veem todos
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR public.is_admin_or_coordinator(auth.uid())
);