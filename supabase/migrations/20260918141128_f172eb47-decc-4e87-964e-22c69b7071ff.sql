-- client_preventive_overview: adiciona exclusão de clientes de estoque interno da oficina
-- (estoque_interno = true, ex.: 'PEÇAS OFICINA'), mantendo o restante da definição idêntico.
CREATE OR REPLACE VIEW public.client_preventive_overview AS
SELECT
  c.id AS client_id,
  c.nome AS client_name,
  c.fazenda,
  c.preventive_frequency_days,
  c.consultor_rplus_id,
  (
    SELECT max(pm.completed_date)
    FROM preventive_maintenance pm
    WHERE pm.client_id = c.id AND pm.status = 'concluida'
  ) AS last_preventive_date,
  CASE
    WHEN (
      SELECT max(pm.completed_date)
      FROM preventive_maintenance pm
      WHERE pm.client_id = c.id AND pm.status = 'concluida'
    ) IS NULL THEN NULL::integer
    ELSE CURRENT_DATE - (
      SELECT max(pm.completed_date)
      FROM preventive_maintenance pm
      WHERE pm.client_id = c.id AND pm.status = 'concluida'
    )
  END AS days_since_last,
  CASE
    WHEN (
      SELECT max(pm.completed_date)
      FROM preventive_maintenance pm
      WHERE pm.client_id = c.id AND pm.status = 'concluida'
    ) IS NULL THEN NULL::integer
    ELSE COALESCE(c.preventive_frequency_days, 90) - (
      CURRENT_DATE - (
        SELECT max(pm.completed_date)
        FROM preventive_maintenance pm
        WHERE pm.client_id = c.id AND pm.status = 'concluida'
      )
    )
  END AS days_until_due,
  CASE
    WHEN (
      SELECT max(pm.completed_date)
      FROM preventive_maintenance pm
      WHERE pm.client_id = c.id AND pm.status = 'concluida'
    ) IS NULL THEN 'sem_historico'
    WHEN (COALESCE(c.preventive_frequency_days, 90) - (
      CURRENT_DATE - (
        SELECT max(pm.completed_date)
        FROM preventive_maintenance pm
        WHERE pm.client_id = c.id AND pm.status = 'concluida'
      )
    )) < 0 THEN 'atrasada'
    WHEN (COALESCE(c.preventive_frequency_days, 90) - (
      CURRENT_DATE - (
        SELECT max(pm.completed_date)
        FROM preventive_maintenance pm
        WHERE pm.client_id = c.id AND pm.status = 'concluida'
      )
    )) <= 30 THEN 'elegivel'
    ELSE 'em_dia'
  END AS preventive_status
FROM clientes c
WHERE c.status = 'ativo'
  AND c.estoque_interno = false;