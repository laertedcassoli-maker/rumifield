ALTER TABLE public.role_menu_permissions
  ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_finalized BOOLEAN NOT NULL DEFAULT false;

UPDATE public.role_menu_permissions SET
  can_edit = true, can_delete = true, can_edit_finalized = true
WHERE role = 'admin' AND menu_group = 'chamados';

UPDATE public.role_menu_permissions SET
  can_edit = true
WHERE role IN ('coordenador_servicos', 'coordenador_rplus') AND menu_group = 'chamados';

UPDATE public.role_menu_permissions SET
  can_edit_finalized = true
WHERE role = 'admin';

UPDATE public.role_menu_permissions SET
  can_edit_finalized = true
WHERE role = 'coordenador_servicos';

UPDATE public.role_menu_permissions SET
  can_edit = true
WHERE role IN ('admin', 'coordenador_servicos') AND menu_group = 'oficina';

CREATE OR REPLACE FUNCTION public.can_edit_completed_checklist(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_menu_permissions rmp
    JOIN public.user_roles ur ON ur.role = rmp.role
    WHERE ur.user_id = _user_id
      AND rmp.can_edit_finalized = true
    LIMIT 1
  );
$$;