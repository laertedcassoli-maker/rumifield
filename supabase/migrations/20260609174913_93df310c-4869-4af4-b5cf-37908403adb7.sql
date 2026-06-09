UPDATE public.role_menu_permissions
SET can_edit_finalized = false
WHERE role = 'coordenador_servicos'
  AND menu_group = 'principal';