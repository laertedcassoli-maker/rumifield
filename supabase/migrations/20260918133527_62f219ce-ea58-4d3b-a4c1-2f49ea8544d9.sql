INSERT INTO public.role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT r::public.app_role, 'agenda_operacoes', 'Agenda de Operações', 'principal',
  r IN ('admin','coordenador_rplus','coordenador_servicos','coordenador_logistica','consultor_rplus')
FROM unnest(ARRAY['admin','coordenador_rplus','consultor_rplus','coordenador_servicos','tecnico_campo','tecnico_oficina','coordenador_logistica','financeiro']) AS r
ON CONFLICT (role, menu_key) DO UPDATE SET
  menu_label = EXCLUDED.menu_label,
  menu_group = EXCLUDED.menu_group,
  can_access = EXCLUDED.can_access;