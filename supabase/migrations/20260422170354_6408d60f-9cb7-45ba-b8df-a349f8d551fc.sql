-- Limpeza completa de "Minhas Rotas": rotas preventivas, visitas, checklists e mídias.
-- Pedidos de peças vinculados são preservados, apenas desvinculados (preventive_id = NULL).

-- 1. Desvincular pedidos de peças que apontam para preventivas (preserva o pedido)
UPDATE public.pedidos SET preventive_id = NULL WHERE preventive_id IS NOT NULL;

-- 2. Apagar consumo de peças das preventivas
DELETE FROM public.preventive_part_consumption;

-- 3. Apagar mídias das visitas preventivas
DELETE FROM public.preventive_visit_media;

-- 4. Apagar ações e não-conformidades dos itens de checklist (filhos primeiro)
DELETE FROM public.preventive_checklist_item_actions;
DELETE FROM public.preventive_checklist_item_nonconformities;

-- 5. Apagar itens, blocos e execuções de checklist
DELETE FROM public.preventive_checklist_items;
DELETE FROM public.preventive_checklist_blocks;
DELETE FROM public.preventive_checklists;

-- 6. Apagar visitas preventivas
DELETE FROM public.preventive_maintenance;

-- 7. Apagar itens de rota e rotas
DELETE FROM public.preventive_route_items;
DELETE FROM public.preventive_routes;