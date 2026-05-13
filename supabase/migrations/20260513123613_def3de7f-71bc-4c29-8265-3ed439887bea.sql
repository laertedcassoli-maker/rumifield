-- Reativar todas as peças que foram desativadas pela sincronização anterior
-- A regra de auto-desativação foi removida; o status agora é manual.
UPDATE public.pecas
SET ativo = true
WHERE ativo = false;