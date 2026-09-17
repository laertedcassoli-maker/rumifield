-- Prompt A: novos campos de responsabilidade em pedidos
ALTER TABLE public.pedidos
  ADD COLUMN tipo_coleta text,
  ADD COLUMN tecnico_responsavel_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN csm_responsavel_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_tipo_coleta_check
  CHECK (tipo_coleta IS NULL OR tipo_coleta IN ('correios', 'coleta_tecnico_csm', 'apenas_nf'));

-- Salvar migration versionada no repositório
-- (conteúdo gravado em supabase/migrations/20260917143000_tipo_coleta_responsaveis.sql)