ALTER TABLE public.installation_stages
  ADD COLUMN IF NOT EXISTS tem_equipamento text,
  ADD COLUMN IF NOT EXISTS nome_equipamento text,
  ADD COLUMN IF NOT EXISTS tem_quimico text,
  ADD COLUMN IF NOT EXISTS qtd_pistolas integer,
  ADD COLUMN IF NOT EXISTS pistolas_em_estoque text,
  ADD COLUMN IF NOT EXISTS qtd_install_kit integer,
  ADD COLUMN IF NOT EXISTS install_kit_em_estoque text,
  ADD COLUMN IF NOT EXISTS qtd_mangueira_ft numeric,
  ADD COLUMN IF NOT EXISTS mangueira_em_estoque text,
  ADD COLUMN IF NOT EXISTS aprovacao_data_inicio date,
  ADD COLUMN IF NOT EXISTS aprovacao_data_fim date;

ALTER TABLE public.installation_stages
  ADD CONSTRAINT installation_stages_tem_equipamento_check CHECK (tem_equipamento IS NULL OR tem_equipamento IN ('sim','nao','na')),
  ADD CONSTRAINT installation_stages_tem_quimico_check CHECK (tem_quimico IS NULL OR tem_quimico IN ('sim','nao','na')),
  ADD CONSTRAINT installation_stages_pistolas_estoque_check CHECK (pistolas_em_estoque IS NULL OR pistolas_em_estoque IN ('sim','nao','na')),
  ADD CONSTRAINT installation_stages_install_kit_estoque_check CHECK (install_kit_em_estoque IS NULL OR install_kit_em_estoque IN ('sim','nao','na')),
  ADD CONSTRAINT installation_stages_mangueira_estoque_check CHECK (mangueira_em_estoque IS NULL OR mangueira_em_estoque IN ('sim','nao','na'));