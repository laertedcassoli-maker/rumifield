-- Insert menu permissions for Oficina module for all roles
-- First insert the oficina parent permission
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT role, 'oficina', 'Oficina', 'principal', 
  CASE WHEN role IN ('admin', 'coordenador_servicos', 'tecnico_oficina') THEN true ELSE false END
FROM unnest(ARRAY['admin', 'coordenador_rplus', 'consultor_rplus', 'coordenador_servicos', 'tecnico_campo', 'tecnico_oficina']::app_role[]) AS role
ON CONFLICT DO NOTHING;

-- Insert oficina_os permission
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT role, 'oficina_os', 'Ordens de Serviço', 'oficina', 
  CASE WHEN role IN ('admin', 'coordenador_servicos', 'tecnico_oficina') THEN true ELSE false END
FROM unnest(ARRAY['admin', 'coordenador_rplus', 'consultor_rplus', 'coordenador_servicos', 'tecnico_campo', 'tecnico_oficina']::app_role[]) AS role
ON CONFLICT DO NOTHING;

-- Insert oficina_atividades permission
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT role, 'oficina_atividades', 'Atividades', 'oficina', 
  CASE WHEN role IN ('admin', 'coordenador_servicos') THEN true ELSE false END
FROM unnest(ARRAY['admin', 'coordenador_rplus', 'consultor_rplus', 'coordenador_servicos', 'tecnico_campo', 'tecnico_oficina']::app_role[]) AS role
ON CONFLICT DO NOTHING;

-- Insert oficina_itens permission
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT role, 'oficina_itens', 'Itens Oficina', 'oficina', 
  CASE WHEN role IN ('admin', 'coordenador_servicos', 'tecnico_oficina') THEN true ELSE false END
FROM unnest(ARRAY['admin', 'coordenador_rplus', 'consultor_rplus', 'coordenador_servicos', 'tecnico_campo', 'tecnico_oficina']::app_role[]) AS role
ON CONFLICT DO NOTHING;