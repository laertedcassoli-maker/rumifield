ALTER TABLE public.corrective_maintenance
  ADD COLUMN preventive_maintenance_id uuid REFERENCES public.preventive_maintenance(id),
  ADD COLUMN contou_como_preventiva boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.corrective_maintenance.preventive_maintenance_id IS 'Vínculo real com o placeholder de preventive_maintenance criado no check-in (substitui o match por texto CORR-VISIT-{visitId} em notes).';
COMMENT ON COLUMN public.corrective_maintenance.contou_como_preventiva IS 'true quando a visita (checklist RumiFlow v1) foi confirmada pelo técnico como preventiva também; o preventive_maintenance vinculado é promovido a concluida.';