-- Create RLS policies for clientes table
-- Allow authenticated users to read clients
CREATE POLICY "Authenticated users can read clientes"
ON public.clientes
FOR SELECT
TO authenticated
USING (true);

-- Allow admins and coordinators to manage clientes
CREATE POLICY "Admins and coordinators can manage clientes"
ON public.clientes
FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));