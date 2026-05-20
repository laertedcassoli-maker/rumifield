CREATE POLICY "Public read corrective maintenance by token"
ON public.corrective_maintenance
FOR SELECT
TO public
USING (public_token IS NOT NULL);

CREATE POLICY "Public read ticket visits via corrective report"
ON public.ticket_visits
FOR SELECT
TO public
USING (
  id IN (
    SELECT cm.visit_id
    FROM public.corrective_maintenance cm
    WHERE cm.public_token IS NOT NULL
      AND cm.visit_id IS NOT NULL
  )
);

CREATE POLICY "Public read tickets via corrective report"
ON public.technical_tickets
FOR SELECT
TO public
USING (
  id IN (
    SELECT tv.ticket_id
    FROM public.ticket_visits tv
    JOIN public.corrective_maintenance cm ON cm.visit_id = tv.id
    WHERE cm.public_token IS NOT NULL
      AND tv.ticket_id IS NOT NULL
  )
);

CREATE POLICY "Public read clients via corrective report"
ON public.clientes
FOR SELECT
TO public
USING (
  id IN (
    SELECT cm.client_id
    FROM public.corrective_maintenance cm
    WHERE cm.public_token IS NOT NULL
      AND cm.client_id IS NOT NULL
  )
);

CREATE POLICY "Public read profiles via corrective report"
ON public.profiles
FOR SELECT
TO public
USING (
  id IN (
    SELECT tv.field_technician_user_id
    FROM public.ticket_visits tv
    JOIN public.corrective_maintenance cm ON cm.visit_id = tv.id
    WHERE cm.public_token IS NOT NULL
      AND tv.field_technician_user_id IS NOT NULL
  )
);