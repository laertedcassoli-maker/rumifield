
-- Add unique constraint to prevent duplicate nonconformities per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_item_nonconformity 
ON public.preventive_checklist_item_nonconformities (exec_item_id, template_nonconformity_id);

-- Add unique constraint to prevent duplicate actions per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_item_action 
ON public.preventive_checklist_item_actions (exec_item_id, template_action_id);

-- Add unique constraint to prevent duplicate part consumption per nonconformity
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_nonconformity_part 
ON public.preventive_part_consumption (exec_nonconformity_id, part_id)
WHERE exec_nonconformity_id IS NOT NULL;
