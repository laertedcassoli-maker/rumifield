
-- Coluna soft-delete em pedido_itens
ALTER TABLE pedido_itens ADD COLUMN cancelled_at timestamptz DEFAULT NULL;
ALTER TABLE pedido_itens ADD COLUMN cancelled_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Tabela de log de alterações em pedidos
CREATE TABLE pedido_item_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id),
  pedido_item_id uuid REFERENCES pedido_itens(id),
  peca_id uuid REFERENCES pecas(id),
  peca_codigo text,
  peca_nome text,
  action text NOT NULL CHECK (action IN ('added','removed','qty_changed')),
  old_quantity int,
  new_quantity int,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pedido_item_log ENABLE ROW LEVEL SECURITY;

-- Leitura para todos autenticados
CREATE POLICY "Authenticated users can read pedido_item_log"
  ON pedido_item_log FOR SELECT
  USING (true);

-- Inserção para admins/coordenadores ou o próprio usuário
CREATE POLICY "Users can insert pedido_item_log"
  ON pedido_item_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
