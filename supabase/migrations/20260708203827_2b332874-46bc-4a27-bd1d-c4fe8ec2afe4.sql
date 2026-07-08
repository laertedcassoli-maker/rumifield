DROP POLICY IF EXISTS "Users can read motor_replacement_history" ON public.motor_replacement_history;

CREATE POLICY "Users can read motor_replacement_history"
  ON public.motor_replacement_history
  FOR SELECT
  TO authenticated
  USING (true);