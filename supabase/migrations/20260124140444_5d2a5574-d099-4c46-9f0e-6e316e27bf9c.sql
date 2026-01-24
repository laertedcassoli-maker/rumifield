-- Add substatus column to technical_tickets
-- Substatus only applies when status = 'em_atendimento'
ALTER TABLE public.technical_tickets 
ADD COLUMN substatus TEXT;

-- Add constraint to ensure valid substatus values
ALTER TABLE public.technical_tickets 
ADD CONSTRAINT valid_substatus CHECK (
  substatus IS NULL 
  OR substatus IN ('aguardando_cliente', 'aguardando_peca', 'aguardando_visita', 'em_visita')
);

-- Add constraint to ensure substatus is only set when status = 'em_atendimento'
ALTER TABLE public.technical_tickets 
ADD CONSTRAINT substatus_only_em_atendimento CHECK (
  (status != 'em_atendimento' AND substatus IS NULL)
  OR (status = 'em_atendimento')
);

-- Comment for documentation
COMMENT ON COLUMN public.technical_tickets.substatus IS 'Operational substatus, only valid when status = em_atendimento. Values: aguardando_cliente, aguardando_peca, aguardando_visita, em_visita';