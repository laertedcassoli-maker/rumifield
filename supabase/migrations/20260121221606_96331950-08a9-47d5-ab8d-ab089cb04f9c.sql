-- Criar tabela de permissões de menu por role
CREATE TABLE public.role_menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  menu_key TEXT NOT NULL,
  menu_label TEXT NOT NULL,
  menu_group TEXT NOT NULL DEFAULT 'principal',
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, menu_key)
);

-- Enable RLS
ALTER TABLE public.role_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Política: todos autenticados podem ler (para carregar menus)
CREATE POLICY "Authenticated users can read menu permissions"
ON public.role_menu_permissions
FOR SELECT
TO authenticated
USING (true);

-- Política: apenas admins podem modificar
CREATE POLICY "Admins can manage menu permissions"
ON public.role_menu_permissions
FOR ALL
TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()))
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_role_menu_permissions_updated_at
BEFORE UPDATE ON public.role_menu_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();