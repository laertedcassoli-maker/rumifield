CREATE POLICY "OS editors can update time_entries"
  ON public.work_order_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_time_entries.work_order_id
        AND (
          wo.created_by_user_id = auth.uid()
          OR wo.assigned_to_user_id = auth.uid()
          OR is_admin_or_coordinator(auth.uid())
          OR has_role(auth.uid(), 'tecnico_oficina')
        )
    )
  );