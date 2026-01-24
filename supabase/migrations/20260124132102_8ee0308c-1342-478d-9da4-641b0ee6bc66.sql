-- Insert menu permissions for Chamados Técnicos module
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access) VALUES
-- Admin - full access
('admin', 'chamados', 'Chamados Técnicos', 'principal', true),
('admin', 'chamados_listagem', 'Listagem Chamados', 'chamados', true),
('admin', 'chamados_criar', 'Criar Chamado', 'chamados', true),

-- Coordenador R+ - read access
('coordenador_rplus', 'chamados', 'Chamados Técnicos', 'principal', true),
('coordenador_rplus', 'chamados_listagem', 'Listagem Chamados', 'chamados', true),
('coordenador_rplus', 'chamados_criar', 'Criar Chamado', 'chamados', false),

-- Consultor R+ - no access by default
('consultor_rplus', 'chamados', 'Chamados Técnicos', 'principal', false),
('consultor_rplus', 'chamados_listagem', 'Listagem Chamados', 'chamados', false),
('consultor_rplus', 'chamados_criar', 'Criar Chamado', 'chamados', false),

-- Coordenador Serviços - full access
('coordenador_servicos', 'chamados', 'Chamados Técnicos', 'principal', true),
('coordenador_servicos', 'chamados_listagem', 'Listagem Chamados', 'chamados', true),
('coordenador_servicos', 'chamados_criar', 'Criar Chamado', 'chamados', true),

-- Técnico de Campo - access to view and create
('tecnico_campo', 'chamados', 'Chamados Técnicos', 'principal', true),
('tecnico_campo', 'chamados_listagem', 'Listagem Chamados', 'chamados', true),
('tecnico_campo', 'chamados_criar', 'Criar Chamado', 'chamados', true),

-- Técnico de Oficina - limited access
('tecnico_oficina', 'chamados', 'Chamados Técnicos', 'principal', false),
('tecnico_oficina', 'chamados_listagem', 'Listagem Chamados', 'chamados', false),
('tecnico_oficina', 'chamados_criar', 'Criar Chamado', 'chamados', false);