-- Add RLS policies for pecas table to allow admins and coordinators to manage parts

-- Policy for INSERT
CREATE POLICY "Admins and coordinators can insert pecas"
ON public.pecas
FOR INSERT
WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- Policy for UPDATE
CREATE POLICY "Admins and coordinators can update pecas"
ON public.pecas
FOR UPDATE
USING (is_admin_or_coordinator(auth.uid()));

-- Policy for DELETE
CREATE POLICY "Admins and coordinators can delete pecas"
ON public.pecas
FOR DELETE
USING (is_admin_or_coordinator(auth.uid()));