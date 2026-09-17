INSERT INTO public.role_menu_permissions (
  role,
  menu_key,
  menu_label,
  menu_group,
  can_access,
  can_edit,
  can_delete,
  can_edit_finalized,
  can_export
)
SELECT
  role,
  'instalacoes_clientes',
  'Clientes',
  'instalacoes_existentes',
  can_access,
  false,
  false,
  false,
  can_export
FROM public.role_menu_permissions
WHERE menu_key = 'crm_clientes'
ON CONFLICT (role, menu_key) DO UPDATE
SET
  menu_label = EXCLUDED.menu_label,
  menu_group = EXCLUDED.menu_group,
  can_access = EXCLUDED.can_access,
  can_export = EXCLUDED.can_export,
  updated_at = now();