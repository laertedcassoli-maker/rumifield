INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized)
SELECT role, 'oficina_gestao_os', 'Gestão de OS', 'oficina', can_access, false, false, false
FROM public.role_menu_permissions
WHERE menu_key = 'oficina_os'
ON CONFLICT (role, menu_key) DO NOTHING;