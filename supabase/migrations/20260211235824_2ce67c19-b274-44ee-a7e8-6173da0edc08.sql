
CREATE SEQUENCE IF NOT EXISTS pedido_code_seq START 1;

ALTER TABLE pedidos ADD COLUMN pedido_code text;

-- Preencher pedidos existentes em ordem cronologica
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM pedidos WHERE pedido_code IS NULL
)
UPDATE pedidos SET pedido_code = 'SP-' || LPAD(nextval('pedido_code_seq')::text, 8, '0')
WHERE id IN (SELECT id FROM ordered);

ALTER TABLE pedidos ADD CONSTRAINT pedidos_pedido_code_unique UNIQUE (pedido_code);

CREATE OR REPLACE FUNCTION generate_pedido_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pedido_code IS NULL OR NEW.pedido_code = '' THEN
    NEW.pedido_code := 'SP-' || LPAD(nextval('pedido_code_seq')::text, 8, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

CREATE TRIGGER set_pedido_code
  BEFORE INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION generate_pedido_code();
