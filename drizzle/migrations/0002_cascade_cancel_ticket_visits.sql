CREATE OR REPLACE FUNCTION public.cascade_cancel_ticket_visits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ids uuid[];
  _note text := '[Cancelada em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] Cancelada junto com o chamado.';
BEGIN
  SELECT array_agg(id) INTO _ids FROM public.ticket_visits
   WHERE ticket_id = NEW.id AND status IN ('em_elaboracao','planejada','em_execucao');
  IF _ids IS NULL THEN RETURN NEW; END IF;

  UPDATE public.ticket_visits
     SET status = 'cancelada',
         internal_notes = CASE WHEN coalesce(internal_notes,'') = '' THEN _note ELSE internal_notes || E'\n\n' || _note END
   WHERE id = ANY(_ids);

  UPDATE public.preventive_maintenance pm
     SET status = 'cancelada', notes = 'Cancelada junto com a visita corretiva: Cancelada junto com o chamado'
   WHERE pm.id IN (SELECT cm.preventive_maintenance_id FROM public.corrective_maintenance cm
                    WHERE cm.visit_id = ANY(_ids) AND cm.preventive_maintenance_id IS NOT NULL)
     AND pm.status NOT IN ('concluida','cancelada');
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.cascade_cancel_ticket_visits() FROM PUBLIC, anon;
CREATE TRIGGER trg_cascade_cancel_ticket_visits
AFTER UPDATE OF status ON public.technical_tickets
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado')
EXECUTE FUNCTION public.cascade_cancel_ticket_visits();