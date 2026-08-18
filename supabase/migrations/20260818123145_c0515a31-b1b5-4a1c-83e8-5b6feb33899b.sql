INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized)
SELECT 'financeiro', menu_key, menu_label, menu_group, false, false, false, false
FROM public.role_menu_permissions
WHERE role = 'admin'
ON CONFLICT (role, menu_key) DO NOTHING;