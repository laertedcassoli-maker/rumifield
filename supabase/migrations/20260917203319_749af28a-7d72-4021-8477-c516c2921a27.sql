INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized, can_export)
SELECT r::public.app_role, 'minhas_pendencias', 'Minhas Pendências', 'principal', true, false, false, false, false
FROM unnest(enum_range(NULL::public.app_role)) AS r
ON CONFLICT (role, menu_key) DO UPDATE
SET menu_label = EXCLUDED.menu_label,
    menu_group = EXCLUDED.menu_group,
    can_access = true,
    updated_at = now();