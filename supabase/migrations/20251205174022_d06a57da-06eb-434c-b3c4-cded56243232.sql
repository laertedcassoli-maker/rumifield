-- Adicionar campo para armazenar quantidade de galões
ALTER TABLE public.envios_produtos 
ADD COLUMN galoes integer NOT NULL DEFAULT 0;