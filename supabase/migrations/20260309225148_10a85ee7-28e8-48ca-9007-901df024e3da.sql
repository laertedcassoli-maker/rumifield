-- Delete checklist items for CRISTIAN MARTINS FERREIRA reset
DELETE FROM preventive_checklist_items 
WHERE exec_block_id IN (
  SELECT id FROM preventive_checklist_blocks 
  WHERE checklist_id = '4faf17eb-9747-4b12-be6d-edcb3a3b3999'
);

-- Delete checklist blocks
DELETE FROM preventive_checklist_blocks 
WHERE checklist_id = '4faf17eb-9747-4b12-be6d-edcb3a3b3999';

-- Delete the checklist execution itself
DELETE FROM preventive_checklists 
WHERE id = '4faf17eb-9747-4b12-be6d-edcb3a3b3999';

-- Reset checkin on route item
UPDATE preventive_route_items 
SET checkin_at = NULL, checkin_lat = NULL, checkin_lon = NULL, status = 'planejado'
WHERE id = '01a5c9f0-ee0c-46b2-a7d1-0881740ba29d';

-- Reset preventive_maintenance back to planejada
UPDATE preventive_maintenance 
SET status = 'planejada', completed_date = NULL
WHERE id = '7c42c660-c60f-4b4d-aea7-88d5e1098998';