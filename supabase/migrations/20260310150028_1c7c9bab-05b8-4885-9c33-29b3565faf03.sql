
-- 1. RPC: reorder blocks in a transaction with validation (1-based)
CREATE OR REPLACE FUNCTION public.reorder_checklist_blocks(p_template_id uuid, p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_count integer;
  provided_count integer;
BEGIN
  provided_count := array_length(p_ordered_ids, 1);
  
  SELECT COUNT(*) INTO actual_count
  FROM checklist_template_blocks
  WHERE template_id = p_template_id
    AND id = ANY(p_ordered_ids);
  
  IF actual_count != provided_count THEN
    RAISE EXCEPTION 'Mismatch: some block IDs do not belong to template %', p_template_id;
  END IF;
  
  FOR i IN 1..provided_count LOOP
    UPDATE checklist_template_blocks
    SET order_index = i
    WHERE id = p_ordered_ids[i] AND template_id = p_template_id;
  END LOOP;
END;
$$;

-- 2. RPC: reorder items in a transaction with validation (1-based)
CREATE OR REPLACE FUNCTION public.reorder_checklist_items(p_block_id uuid, p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_count integer;
  provided_count integer;
BEGIN
  provided_count := array_length(p_ordered_ids, 1);
  
  SELECT COUNT(*) INTO actual_count
  FROM checklist_template_items
  WHERE block_id = p_block_id
    AND id = ANY(p_ordered_ids);
  
  IF actual_count != provided_count THEN
    RAISE EXCEPTION 'Mismatch: some item IDs do not belong to block %', p_block_id;
  END IF;
  
  FOR i IN 1..provided_count LOOP
    UPDATE checklist_template_items
    SET order_index = i
    WHERE id = p_ordered_ids[i] AND block_id = p_block_id;
  END LOOP;
END;
$$;

-- 3. Trigger BEFORE INSERT: auto-assign order_index = max + 1 for blocks
CREATE OR REPLACE FUNCTION public.set_checklist_block_order_index()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_index integer;
BEGIN
  IF NEW.order_index IS NULL OR NEW.order_index = 0 THEN
    SELECT COALESCE(MAX(order_index), 0) + 1
    INTO next_index
    FROM checklist_template_blocks
    WHERE template_id = NEW.template_id;
    NEW.order_index := next_index;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_checklist_block_order
BEFORE INSERT ON public.checklist_template_blocks
FOR EACH ROW
EXECUTE FUNCTION public.set_checklist_block_order_index();

-- 4. Trigger BEFORE INSERT: auto-assign order_index = max + 1 for items
CREATE OR REPLACE FUNCTION public.set_checklist_item_order_index()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_index integer;
BEGIN
  IF NEW.order_index IS NULL OR NEW.order_index = 0 THEN
    SELECT COALESCE(MAX(order_index), 0) + 1
    INTO next_index
    FROM checklist_template_items
    WHERE block_id = NEW.block_id;
    NEW.order_index := next_index;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_checklist_item_order
BEFORE INSERT ON public.checklist_template_items
FOR EACH ROW
EXECUTE FUNCTION public.set_checklist_item_order_index();

-- 5. Trigger AFTER DELETE: recompact block order_index
CREATE OR REPLACE FUNCTION public.recompact_checklist_block_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS new_index
    FROM checklist_template_blocks
    WHERE template_id = OLD.template_id
  )
  UPDATE checklist_template_blocks b
  SET order_index = numbered.new_index
  FROM numbered
  WHERE b.id = numbered.id AND b.order_index != numbered.new_index;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_recompact_checklist_block_order
AFTER DELETE ON public.checklist_template_blocks
FOR EACH ROW
EXECUTE FUNCTION public.recompact_checklist_block_order();

-- 6. Trigger AFTER DELETE: recompact item order_index
CREATE OR REPLACE FUNCTION public.recompact_checklist_item_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS new_index
    FROM checklist_template_items
    WHERE block_id = OLD.block_id
  )
  UPDATE checklist_template_items i
  SET order_index = numbered.new_index
  FROM numbered
  WHERE i.id = numbered.id AND i.order_index != numbered.new_index;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_recompact_checklist_item_order
AFTER DELETE ON public.checklist_template_items
FOR EACH ROW
EXECUTE FUNCTION public.recompact_checklist_item_order();

-- 7. Recompact existing data to 1-based before adding constraints
UPDATE checklist_template_blocks b
SET order_index = sub.new_index
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY order_index) AS new_index
  FROM checklist_template_blocks
) sub
WHERE b.id = sub.id;

UPDATE checklist_template_items i
SET order_index = sub.new_index
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY block_id ORDER BY order_index) AS new_index
  FROM checklist_template_items
) sub
WHERE i.id = sub.id;
