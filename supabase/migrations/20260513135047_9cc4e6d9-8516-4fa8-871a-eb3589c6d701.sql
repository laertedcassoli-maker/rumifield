
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS imilk_id_contrato bigint,
  ADD COLUMN IF NOT EXISTS imilk_produto text,
  ADD COLUMN IF NOT EXISTS imilk_csm text,
  ADD COLUMN IF NOT EXISTS imilk_valor numeric,
  ADD COLUMN IF NOT EXISTS imilk_valor_bruto numeric,
  ADD COLUMN IF NOT EXISTS imilk_plano_congelado boolean,
  ADD COLUMN IF NOT EXISTS imilk_data_proximo_faturamento date;
