CREATE OR REPLACE FUNCTION public.is_public_preventive_visit(_preventive_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.preventive_maintenance pm
    WHERE pm.id = _preventive_id
      AND (
        (pm.public_token IS NOT NULL AND pm.status = 'concluida')
        OR EXISTS (
          SELECT 1 FROM public.corrective_maintenance cm
          WHERE cm.public_token IS NOT NULL
            AND cm.status = 'concluida'
            AND cm.client_id = pm.client_id
            AND pm.notes ILIKE '%CORR-VISIT-' || cm.visit_id::text || '%'
        )
      )
  )
$function$;