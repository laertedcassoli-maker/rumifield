-- Add new fields to clientes table

-- Panel type: 2x or 3x
ALTER TABLE public.clientes
ADD COLUMN tipo_painel TEXT CHECK (tipo_painel IN ('2x', '3x'));

-- Pistol type: references a peca (omie product)
ALTER TABLE public.clientes
ADD COLUMN tipo_pistola_id UUID REFERENCES public.pecas(id);

-- Number of pistols in use: 1 to 3
ALTER TABLE public.clientes
ADD COLUMN quantidade_pistolas INTEGER CHECK (quantidade_pistolas >= 1 AND quantidade_pistolas <= 3);

-- Geolocation
ALTER TABLE public.clientes
ADD COLUMN latitude NUMERIC,
ADD COLUMN longitude NUMERIC;

-- Google Maps link (auto-generated or manual)
ALTER TABLE public.clientes
ADD COLUMN link_maps TEXT;

-- R+ Consultant: references user profile
ALTER TABLE public.clientes
ADD COLUMN consultor_rplus_id UUID REFERENCES public.profiles(id);

-- Add indexes for common queries
CREATE INDEX idx_clientes_consultor ON public.clientes(consultor_rplus_id);
CREATE INDEX idx_clientes_tipo_pistola ON public.clientes(tipo_pistola_id);

-- Comments for documentation
COMMENT ON COLUMN public.clientes.tipo_painel IS 'Tipo de painel: 2x ou 3x ordenhas';
COMMENT ON COLUMN public.clientes.tipo_pistola_id IS 'Referência ao modelo de pistola usado (tabela pecas)';
COMMENT ON COLUMN public.clientes.quantidade_pistolas IS 'Quantidade de pistolas em uso (1 a 3)';
COMMENT ON COLUMN public.clientes.latitude IS 'Latitude da fazenda';
COMMENT ON COLUMN public.clientes.longitude IS 'Longitude da fazenda';
COMMENT ON COLUMN public.clientes.link_maps IS 'Link do Google Maps para a fazenda';
COMMENT ON COLUMN public.clientes.consultor_rplus_id IS 'Consultor R+ responsável pelo cliente';