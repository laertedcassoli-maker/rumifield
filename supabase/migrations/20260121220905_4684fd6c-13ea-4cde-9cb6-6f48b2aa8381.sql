-- Política para user_roles: usuários podem ver seu próprio role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política para profiles: usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Política para profiles: usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Política para configuracoes: todos autenticados podem ler (menu config)
CREATE POLICY "Authenticated users can read config"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (true);