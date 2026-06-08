INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized) VALUES
('admin',                 'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', true,  true,  true,  true),
('coordenador_rplus',     'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', false, false, false, false),
('consultor_rplus',       'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', false, false, false, false),
('coordenador_servicos',  'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', true,  true,  false, false),
('coordenador_logistica', 'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', false, false, false, false),
('tecnico_campo',         'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', true,  false, false, false),
('tecnico_oficina',       'minhas_rotas_listagem', 'Listagem de Rotas', 'minhas_rotas', false, false, false, false)
ON CONFLICT (role, menu_key) DO NOTHING;