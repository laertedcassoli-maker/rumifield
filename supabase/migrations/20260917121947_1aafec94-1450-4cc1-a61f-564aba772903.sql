UPDATE public.role_menu_permissions
SET menu_group = 'instalacoes_existentes',
    updated_at = now()
WHERE menu_key IN ('preventivas', 'chamados');