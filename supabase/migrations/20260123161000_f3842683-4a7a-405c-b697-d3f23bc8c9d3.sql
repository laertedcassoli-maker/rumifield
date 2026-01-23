-- Add a dedicated ordering column for route items
ALTER TABLE public.preventive_route_items
ADD COLUMN IF NOT EXISTS order_index integer;

-- Backfill order_index for existing rows (per route)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY route_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.preventive_route_items
)
UPDATE public.preventive_route_items pri
SET order_index = ranked.rn
FROM ranked
WHERE pri.id = ranked.id
  AND pri.order_index IS NULL;

-- Ensure new inserts get a sequential order_index if not provided
CREATE OR REPLACE FUNCTION public.set_preventive_route_item_order_index()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_index integer;
BEGIN
  IF NEW.order_index IS NULL THEN
    SELECT COALESCE(MAX(order_index), 0) + 1
    INTO next_index
    FROM public.preventive_route_items
    WHERE route_id = NEW.route_id;

    NEW.order_index := next_index;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_preventive_route_item_order_index ON public.preventive_route_items;
CREATE TRIGGER trg_set_preventive_route_item_order_index
BEFORE INSERT ON public.preventive_route_items
FOR EACH ROW
EXECUTE FUNCTION public.set_preventive_route_item_order_index();

-- Index to speed up ordering queries
CREATE INDEX IF NOT EXISTS idx_preventive_route_items_route_order
ON public.preventive_route_items (route_id, order_index);
