
CREATE OR REPLACE FUNCTION public.duplicate_checklist_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_template_id uuid;
  v_original_name text;
  v_original_desc text;
  v_block record;
  v_new_block_id uuid;
  v_item record;
  v_new_item_id uuid;
  v_action record;
  v_new_action_id uuid;
  v_nc record;
  v_new_nc_id uuid;
  v_part record;
BEGIN
  -- Get original template
  SELECT name, description INTO v_original_name, v_original_desc
  FROM checklist_templates WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Create new template
  INSERT INTO checklist_templates (name, description)
  VALUES (v_original_name || ' (Cópia)', v_original_desc)
  RETURNING id INTO v_new_template_id;

  -- Duplicate blocks
  FOR v_block IN
    SELECT * FROM checklist_template_blocks
    WHERE template_id = p_template_id
    ORDER BY order_index
  LOOP
    INSERT INTO checklist_template_blocks (template_id, block_name, order_index)
    VALUES (v_new_template_id, v_block.block_name, v_block.order_index)
    RETURNING id INTO v_new_block_id;

    -- Duplicate items
    FOR v_item IN
      SELECT * FROM checklist_template_items
      WHERE block_id = v_block.id
      ORDER BY order_index
    LOOP
      INSERT INTO checklist_template_items (block_id, item_name, order_index, active)
      VALUES (v_new_block_id, v_item.item_name, v_item.order_index, v_item.active)
      RETURNING id INTO v_new_item_id;

      -- Duplicate corrective actions
      FOR v_action IN
        SELECT * FROM checklist_item_corrective_actions
        WHERE item_id = v_item.id
        ORDER BY order_index
      LOOP
        INSERT INTO checklist_item_corrective_actions (item_id, action_label, order_index, active)
        VALUES (v_new_item_id, v_action.action_label, v_action.order_index, v_action.active)
        RETURNING id INTO v_new_action_id;

        -- Duplicate action parts
        FOR v_part IN
          SELECT * FROM checklist_action_parts
          WHERE action_id = v_action.id
        LOOP
          INSERT INTO checklist_action_parts (action_id, part_id, default_quantity)
          VALUES (v_new_action_id, v_part.part_id, v_part.default_quantity);
        END LOOP;
      END LOOP;

      -- Duplicate nonconformities
      FOR v_nc IN
        SELECT * FROM checklist_item_nonconformities
        WHERE item_id = v_item.id
        ORDER BY order_index
      LOOP
        INSERT INTO checklist_item_nonconformities (item_id, nonconformity_label, order_index, active)
        VALUES (v_new_item_id, v_nc.nonconformity_label, v_nc.order_index, v_nc.active)
        RETURNING id INTO v_new_nc_id;

        -- Duplicate nonconformity parts
        FOR v_part IN
          SELECT * FROM checklist_nonconformity_parts
          WHERE nonconformity_id = v_nc.id
        LOOP
          INSERT INTO checklist_nonconformity_parts (nonconformity_id, part_id, default_quantity)
          VALUES (v_new_nc_id, v_part.part_id, v_part.default_quantity);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_new_template_id;
END;
$$;
