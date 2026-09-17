-- Tipo da solicitação: envio (padrão para tudo que já existe) ou coleta reversa
ALTER TABLE public.pedidos
  ADD COLUMN tipo_solicitacao text NOT NULL DEFAULT 'envio'
    CONSTRAINT pedidos_tipo_solicitacao_check CHECK (tipo_solicitacao IN ('envio', 'coleta_reversa'));

-- Flag de geração automática de coleta reversa
ALTER TABLE public.pedidos
  ADD COLUMN gera_coleta_reversa_automatica boolean NOT NULL DEFAULT false;

-- Vínculo com o envio de origem (1:N — sem constraint de unicidade, permite reenvio parcial)
ALTER TABLE public.pedidos
  ADD COLUMN coleta_reversa_origem_id uuid REFERENCES public.pedidos(id);