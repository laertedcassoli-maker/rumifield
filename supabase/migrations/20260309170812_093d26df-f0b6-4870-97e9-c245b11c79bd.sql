
-- work_order_items policies
DROP POLICY IF EXISTS "Users can insert work_order_items" ON work_order_items;
CREATE POLICY "Users can insert work_order_items" ON work_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_items.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );

DROP POLICY IF EXISTS "Users can update work_order_items" ON work_order_items;
CREATE POLICY "Users can update work_order_items" ON work_order_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_items.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );

DROP POLICY IF EXISTS "Users can delete work_order_items" ON work_order_items;
CREATE POLICY "Users can delete work_order_items" ON work_order_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_items.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );

-- work_order_parts_used policies
DROP POLICY IF EXISTS "Users can insert work_order_parts_used" ON work_order_parts_used;
CREATE POLICY "Users can insert work_order_parts_used" ON work_order_parts_used
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_parts_used.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );

DROP POLICY IF EXISTS "Users can update work_order_parts_used" ON work_order_parts_used;
CREATE POLICY "Users can update work_order_parts_used" ON work_order_parts_used
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_parts_used.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );

DROP POLICY IF EXISTS "Users can delete work_order_parts_used" ON work_order_parts_used;
CREATE POLICY "Users can delete work_order_parts_used" ON work_order_parts_used
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_parts_used.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );
