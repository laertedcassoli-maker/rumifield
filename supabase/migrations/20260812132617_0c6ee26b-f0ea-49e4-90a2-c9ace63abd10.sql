ALTER TABLE public.pecas
ADD COLUMN classificacao_of text,
ADD COLUMN classificacao_jv text;

ALTER TABLE public.pecas
ADD CONSTRAINT pecas_classificacao_of_check
CHECK (
  classificacao_of IS NULL
  OR classificacao_of IN (
    'USO E CONSUMO',
    'PRESTAÇÃO DE SERVIÇO',
    'REVENDA',
    'COMODATO',
    'INDUSTRIALIZAÇÃO',
    'REVENDA / PRESTAÇÃO DE SERVIÇO',
    'N/A'
  )
);

ALTER TABLE public.pecas
ADD CONSTRAINT pecas_classificacao_jv_check
CHECK (
  classificacao_jv IS NULL
  OR classificacao_jv IN (
    'USO E CONSUMO',
    'PRESTAÇÃO DE SERVIÇO',
    'REVENDA',
    'COMODATO',
    'INDUSTRIALIZAÇÃO',
    'REVENDA / PRESTAÇÃO DE SERVIÇO',
    'N/A'
  )
);