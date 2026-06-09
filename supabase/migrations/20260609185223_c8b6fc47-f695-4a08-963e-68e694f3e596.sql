-- Ensure all 7 roles have entries for every existing menu_key.
-- Explicit inserts requested by user (coordenador_logistica chamados group + minhas_rotas).
-- All use ON CONFLICT DO NOTHING — never overwrite existing entries.

INSERT INTO public.role_menu_permissions
  (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized)
VALUES
  ('coordenador_logistica', 'chamados',          'Chamados Técnicos', 'principal', false, false, false, false),
  ('coordenador_logistica', 'chamados_listagem', 'Listagem Chamados', 'chamados',  false, false, false, false),
  ('coordenador_logistica', 'chamados_criar',    'Criar Chamado',     'chamados',  false, false, false, false),
  ('coordenador_logistica', 'minhas_rotas',      'Minhas Rotas',      'principal', false, false, false, false)
ON CONFLICT (role, menu_key) DO NOTHING;

-- Backfill any other gaps: for every (role, menu_key) combination missing from
-- the table, insert a fully-locked entry (all permissions false). Uses existing
-- menu_label/menu_group from any role that already has that menu_key.
INSERT INTO public.role_menu_permissions
  (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized)
SELECT r.role::app_role, k.menu_key, k.menu_label, k.menu_group, false, false, false, false
FROM (
  SELECT unnest(ARRAY[
    'admin','coordenador_rplus','consultor_rplus','coordenador_servicos',
    'coordenador_logistica','tecnico_campo','tecnico_oficina'
  ]) AS role
) r
CROSS JOIN (
  SELECT DISTINCT ON (menu_key) menu_key, menu_label, menu_group
  FROM public.role_menu_permissions
  ORDER BY menu_key, menu_label
) k
ON CONFLICT (role, menu_key) DO NOTHING;