-- Fix the security definer view issue by recreating it with SECURITY INVOKER
DROP VIEW IF EXISTS public.client_preventive_overview;

CREATE VIEW public.client_preventive_overview 
WITH (security_invoker = true)
AS
SELECT 
  c.id as client_id,
  c.nome as client_name,
  c.fazenda,
  c.preventive_frequency_days,
  c.consultor_rplus_id,
  (SELECT MAX(pm.completed_date) 
   FROM preventive_maintenance pm 
   WHERE pm.client_id = c.id AND pm.status = 'concluida') as last_preventive_date,
  CASE 
    WHEN (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida') IS NULL 
    THEN NULL
    ELSE CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida')
  END as days_since_last,
  CASE 
    WHEN (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida') IS NULL 
    THEN NULL
    ELSE COALESCE(c.preventive_frequency_days, 90) - (CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida'))
  END as days_until_due,
  CASE 
    WHEN (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida') IS NULL 
    THEN 'sem_historico'
    WHEN COALESCE(c.preventive_frequency_days, 90) - (CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida')) < 0 
    THEN 'atrasada'
    WHEN COALESCE(c.preventive_frequency_days, 90) - (CURRENT_DATE - (SELECT MAX(pm.completed_date) FROM preventive_maintenance pm WHERE pm.client_id = c.id AND pm.status = 'concluida')) <= 30 
    THEN 'elegivel'
    ELSE 'em_dia'
  END as preventive_status
FROM clientes c
WHERE c.status = 'ativo';