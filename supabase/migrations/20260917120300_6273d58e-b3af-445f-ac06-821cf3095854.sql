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
  'crm',
  'CRM',
  'principal',
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
  'instalacoes_existentes',
  'Instalações Existentes',
  'principal',
  bool_or(can_access),
  false,
  false,
  false,
  bool_or(can_export)
FROM public.role_menu_permissions
WHERE menu_key IN ('preventivas', 'chamados', 'crm_clientes')
GROUP BY role
ON CONFLICT (role, menu_key) DO UPDATE
SET
  menu_label = EXCLUDED.menu_label,
  menu_group = EXCLUDED.menu_group,
  can_access = EXCLUDED.can_access,
  can_export = EXCLUDED.can_export,
  updated_at = now();

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
  'visita_tecnica',
  'Visita Técnica',
  'instalacoes_existentes',
  can_access,
  can_edit,
  can_delete,
  can_edit_finalized,
  can_export
FROM public.role_menu_permissions
WHERE menu_key = 'chamados'
ON CONFLICT (role, menu_key) DO UPDATE
SET
  menu_label = EXCLUDED.menu_label,
  menu_group = EXCLUDED.menu_group,
  can_access = EXCLUDED.can_access,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_edit_finalized = EXCLUDED.can_edit_finalized,
  can_export = EXCLUDED.can_export,
  updated_at = now();

UPDATE public.role_menu_permissions
SET menu_label = 'Centro de Serviços', updated_at = now()
WHERE menu_key = 'oficina';

UPDATE public.role_menu_permissions
SET menu_label = 'Atividades do Centro de Serviços', updated_at = now()
WHERE menu_key = 'oficina_atividades';