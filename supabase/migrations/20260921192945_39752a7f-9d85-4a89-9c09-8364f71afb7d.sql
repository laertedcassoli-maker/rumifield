CREATE TABLE public.technician_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_user_id uuid NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.technician_absences TO authenticated;
GRANT ALL ON public.technician_absences TO service_role;

ALTER TABLE public.technician_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view absences"
ON public.technician_absences FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and service coordinators can create absences"
ON public.technician_absences FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador_servicos'));

CREATE POLICY "Admins and service coordinators can delete absences"
ON public.technician_absences FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador_servicos'));

CREATE INDEX idx_technician_absences_tech ON public.technician_absences(technician_user_id);
CREATE INDEX idx_technician_absences_dates ON public.technician_absences(start_date, end_date);