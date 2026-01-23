
-- Allow public read access to clientes when accessed via preventive_maintenance join
-- This is needed for the public report page to display client name
CREATE POLICY "Public read for clientes via preventive report" 
ON public.clientes 
FOR SELECT 
USING (
  id IN (
    SELECT client_id FROM public.preventive_maintenance 
    WHERE public_token IS NOT NULL
  )
);
