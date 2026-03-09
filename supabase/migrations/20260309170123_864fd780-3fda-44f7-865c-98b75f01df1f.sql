
DROP POLICY IF EXISTS "Users can update assigned work_orders" ON work_orders;
CREATE POLICY "Users can update assigned work_orders" ON work_orders
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = assigned_to_user_id 
    OR auth.uid() = created_by_user_id
    OR is_admin_or_coordinator(auth.uid())
    OR public.has_role(auth.uid(), 'tecnico_oficina')
  );
