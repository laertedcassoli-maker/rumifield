-- Fix data for visit PREV-2026-00005 / FELIPE DUBEUX DE MIRANDA
DO $$
DECLARE
  v_preventive_id uuid := '317539ef-8b43-4f31-a425-a2e940160a90';
  v_part_id uuid := 'ea0d5d52-41ea-4c72-b864-165d57edfc39';
  v_part_code text := 'PRD00602';
  v_part_name text := 'ROLAMENTO DA TAMPA DA ESCOVA (IMP0035)';
BEGIN
  -- Pistola 1: insert linked consumption if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.preventive_part_consumption
    WHERE preventive_id = v_preventive_id
      AND exec_nonconformity_id = '3ed3089a-a9d9-488b-a30d-ca541fedcc7e'
  ) THEN
    INSERT INTO public.preventive_part_consumption
      (preventive_id, part_id, part_code_snapshot, part_name_snapshot, quantity,
       exec_item_id, exec_nonconformity_id, is_manual, stock_source)
    VALUES
      (v_preventive_id, v_part_id, v_part_code, v_part_name, 1,
       'f95a1c94-0755-49b9-bef5-f1f54ce99b94',
       '3ed3089a-a9d9-488b-a30d-ca541fedcc7e',
       false, 'tecnico');
  END IF;

  -- Pistola 2: insert linked consumption if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.preventive_part_consumption
    WHERE preventive_id = v_preventive_id
      AND exec_nonconformity_id = '925426a6-7566-46bc-a000-fe13314e5999'
  ) THEN
    INSERT INTO public.preventive_part_consumption
      (preventive_id, part_id, part_code_snapshot, part_name_snapshot, quantity,
       exec_item_id, exec_nonconformity_id, is_manual, stock_source)
    VALUES
      (v_preventive_id, v_part_id, v_part_code, v_part_name, 1,
       '6225d4b1-c7d8-47fe-854f-881c6558922c',
       '925426a6-7566-46bc-a000-fe13314e5999',
       false, 'tecnico');
  END IF;

  -- Remove the orphan manual entry of the same part (qty 12) so totals are correct
  DELETE FROM public.preventive_part_consumption
  WHERE id = '7bb4fa20-fc65-4ecc-9b96-eb281ed45418';
END $$;