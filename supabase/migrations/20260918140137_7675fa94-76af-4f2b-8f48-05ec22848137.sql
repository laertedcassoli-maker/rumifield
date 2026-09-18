-- =====================================================================
-- Migration de DOCUMENTAÇÃO / REPRODUTIBILIDADE.
-- Este retroativo (backfill de preventive_maintenance_id via match legado
-- por texto 'CORR-VISIT-{visit_id}' nas notes, promoção para 'concluida'
-- das preventivas de visitas corretivas já encerradas com o checklist
-- RumiFlow v1, e marcação de contou_como_preventiva = true) já foi
-- aplicado manualmente em produção. Esta migration apenas registra o
-- procedimento no histórico para que um ambiente recriado do zero produza
-- o mesmo resultado. As três operações são idempotentes: rodar de novo
-- não altera nenhuma linha que já esteja no estado final.
-- =====================================================================

-- 1. Backfill do vínculo corretiva -> preventiva (match legado por texto), só onde ainda está nulo
UPDATE public.corrective_maintenance cm
SET preventive_maintenance_id = pm.id
FROM public.preventive_maintenance pm
WHERE cm.preventive_maintenance_id IS NULL
  AND pm.notes ILIKE '%CORR-VISIT-' || cm.visit_id || '%';

-- 2. Promoção para 'concluida' das preventivas vinculadas a corretivas já concluídas
--    com o checklist RumiFlow v1, usando a data real de encerramento (checkout_at)
UPDATE public.preventive_maintenance pm
SET status = 'concluida',
    completed_date = cm.checkout_at::date
FROM public.corrective_maintenance cm
WHERE cm.preventive_maintenance_id = pm.id
  AND cm.checklist_template_id = '3b86c956-891a-4a82-9871-d8a5c2981a6d'
  AND cm.status = 'concluida'
  AND pm.status <> 'concluida';

-- 3. Marcação de contou_como_preventiva nas corretivas correspondentes, só onde ainda é false
UPDATE public.corrective_maintenance cm
SET contou_como_preventiva = true
FROM public.preventive_maintenance pm
WHERE cm.preventive_maintenance_id = pm.id
  AND cm.checklist_template_id = '3b86c956-891a-4a82-9871-d8a5c2981a6d'
  AND cm.status = 'concluida'
  AND pm.status = 'concluida'
  AND cm.contou_como_preventiva = false;
