ALTER TABLE public.role_menu_permissions ADD COLUMN IF NOT EXISTS can_export boolean NOT NULL DEFAULT false;

UPDATE public.role_menu_permissions
SET can_export = true
WHERE role IN ('admin','coordenador_rplus','coordenador_servicos','coordenador_logistica','financeiro');