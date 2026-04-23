-- Fix RLS policy that blocks technicians from completing checklists.
-- The previous policy had USING (status = 'em_andamento') and no explicit WITH CHECK,
-- so Postgres applied USING to the new row, blocking the very transition to 'concluido'.

DROP POLICY IF EXISTS "Technicians can update own preventive_checklists"
  ON public.preventive_checklists;

CREATE POLICY "Technicians can update own preventive_checklists"
ON public.preventive_checklists
FOR UPDATE
TO authenticated
USING (
  status = 'em_andamento'::checklist_execution_status
  AND EXISTS (
    SELECT 1
    FROM public.preventive_maintenance pm
    WHERE pm.id = preventive_checklists.preventive_id
      AND (
        pm.technician_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.preventive_routes pr
          WHERE pr.id = pm.route_id
            AND pr.field_technician_user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.preventive_maintenance pm
    WHERE pm.id = preventive_checklists.preventive_id
      AND (
        pm.technician_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.preventive_routes pr
          WHERE pr.id = pm.route_id
            AND pr.field_technician_user_id = auth.uid()
        )
      )
  )
);