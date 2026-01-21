
-- Enable RLS policy for pecas table to allow authenticated users to read
CREATE POLICY "Authenticated users can read pecas"
ON public.pecas
FOR SELECT
TO authenticated
USING (true);
