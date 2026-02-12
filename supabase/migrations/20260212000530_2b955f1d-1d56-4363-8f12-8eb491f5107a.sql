
-- 1. Adicionar novo valor ao enum (deve ser commitado separadamente)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador_logistica';
