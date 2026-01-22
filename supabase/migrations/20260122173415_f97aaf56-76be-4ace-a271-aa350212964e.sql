-- Allow admins and coordinators to update motor_replacement_history (for assigning warranty batches)
CREATE POLICY "Admins can update motor_replacement_history"
ON public.motor_replacement_history
FOR UPDATE
USING (is_admin_or_coordinator(auth.uid()));