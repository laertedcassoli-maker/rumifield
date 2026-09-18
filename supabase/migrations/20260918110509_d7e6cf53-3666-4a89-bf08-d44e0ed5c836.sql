-- Instalações — Fase 2: acesso ao menu lateral
INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
VALUES
  ('admin', 'instalacoes', 'Instalações', 'principal', true),
  ('coordenador_rplus', 'instalacoes', 'Instalações', 'principal', true),
  ('consultor_rplus', 'instalacoes', 'Instalações', 'principal', true),
  ('coordenador_servicos', 'instalacoes', 'Instalações', 'principal', true),
  ('tecnico_campo', 'instalacoes', 'Instalações', 'principal', true)
ON CONFLICT (role, menu_key) DO UPDATE
SET can_access = EXCLUDED.can_access,
    menu_label = EXCLUDED.menu_label,
    menu_group = EXCLUDED.menu_group;