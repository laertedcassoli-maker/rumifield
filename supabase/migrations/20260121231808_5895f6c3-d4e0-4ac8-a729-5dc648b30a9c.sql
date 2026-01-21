-- Fix overly permissive RLS policies for work_order_items
DROP POLICY IF EXISTS "Users can manage work_order_items" ON public.work_order_items;

CREATE POLICY "Users can insert work_order_items"
  ON public.work_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid() OR is_admin_or_coordinator(auth.uid()))
    )
  );

CREATE POLICY "Users can update work_order_items"
  ON public.work_order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid() OR is_admin_or_coordinator(auth.uid()))
    )
  );

CREATE POLICY "Users can delete work_order_items"
  ON public.work_order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid() OR is_admin_or_coordinator(auth.uid()))
    )
  );

-- Fix overly permissive RLS policies for work_order_parts_used
DROP POLICY IF EXISTS "Users can manage parts_used" ON public.work_order_parts_used;

CREATE POLICY "Users can insert parts_used"
  ON public.work_order_parts_used FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = added_by_user_id AND
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid() OR is_admin_or_coordinator(auth.uid()))
    )
  );

CREATE POLICY "Users can update parts_used"
  ON public.work_order_parts_used FOR UPDATE
  TO authenticated
  USING (
    added_by_user_id = auth.uid() OR is_admin_or_coordinator(auth.uid())
  );

CREATE POLICY "Users can delete parts_used"
  ON public.work_order_parts_used FOR DELETE
  TO authenticated
  USING (
    added_by_user_id = auth.uid() OR is_admin_or_coordinator(auth.uid())
  );