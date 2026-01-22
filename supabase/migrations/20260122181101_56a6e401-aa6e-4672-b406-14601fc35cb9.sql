-- Allow admins and coordinators to manage user_roles
CREATE POLICY "Admins can insert user_roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins can update user_roles" 
ON public.user_roles 
FOR UPDATE 
TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins can delete user_roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (is_admin_or_coordinator(auth.uid()));