ALTER TABLE public.installation_stages
  ADD COLUMN IF NOT EXISTS tem_equipamento_previsao_data date,
  ADD COLUMN IF NOT EXISTS tem_quimico_previsao_data date,
  ADD COLUMN IF NOT EXISTS pistolas_previsao_data date,
  ADD COLUMN IF NOT EXISTS install_kit_previsao_data date,
  ADD COLUMN IF NOT EXISTS mangueira_previsao_data date;