-- Add interaction_type to support manual interactions in timeline
-- Types: 'system' (automatic events), 'call' (ligação), 'message' (mensagem), 'waiting' (aguardando), 'note' (nota interna)
ALTER TABLE public.ticket_timeline 
ADD COLUMN IF NOT EXISTS interaction_type TEXT DEFAULT 'system';

-- Add notes field for detailed interaction content
ALTER TABLE public.ticket_timeline 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for better querying
CREATE INDEX IF NOT EXISTS idx_ticket_timeline_interaction_type ON public.ticket_timeline(interaction_type);

-- Update existing records to have 'system' type
UPDATE public.ticket_timeline SET interaction_type = 'system' WHERE interaction_type IS NULL;