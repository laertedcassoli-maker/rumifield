
-- Add is_active column to profiles
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Allow admins/coordinators to update any profile (for deactivation)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin_or_coordinator(auth.uid()));
