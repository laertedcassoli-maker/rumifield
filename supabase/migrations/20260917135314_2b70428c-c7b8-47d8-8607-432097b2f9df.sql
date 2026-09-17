INSERT INTO public.role_menu_permissions
  (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized, can_export)
SELECT role, 'pedidos_envios', 'Envios', 'pedidos', can_access, can_edit, can_delete, can_edit_finalized, can_export
FROM public.role_menu_permissions WHERE menu_key = 'pedidos'
ON CONFLICT (role, menu_key) DO UPDATE SET menu_label = EXCLUDED.menu_label, menu_group = EXCLUDED.menu_group, updated_at = now();

INSERT INTO public.role_menu_permissions
  (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized, can_export)
SELECT role, 'pedidos_coleta_reversa', 'Coleta Reversa', 'pedidos', can_access, can_edit, can_delete, can_edit_finalized, can_export
FROM public.role_menu_permissions WHERE menu_key = 'pedidos'
ON CONFLICT (role, menu_key) DO UPDATE SET menu_label = EXCLUDED.menu_label, menu_group = EXCLUDED.menu_group, updated_at = now();

UPDATE public.role_menu_permissions
SET menu_group = 'pedidos', menu_label = 'Solicitação de Peças', updated_at = now()
WHERE menu_key = 'pedidos';