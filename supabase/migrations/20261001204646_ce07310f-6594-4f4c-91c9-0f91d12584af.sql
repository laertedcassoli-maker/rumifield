INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete) VALUES
('admin','estoque_uso_consumo','Estoque Uso/Consumo','principal',true,true,true),
('coordenador_servicos','estoque_uso_consumo','Estoque Uso/Consumo','principal',true,true,true),
('tecnico_oficina','estoque_uso_consumo','Estoque Uso/Consumo','principal',true,true,true),
('tecnico_campo','estoque_uso_consumo','Estoque Uso/Consumo','principal',true,false,true)
ON CONFLICT (role, menu_key) DO NOTHING;