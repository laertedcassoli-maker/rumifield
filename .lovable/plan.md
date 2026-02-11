

## Numero sequencial para pedidos (SP-00000001) - apenas no servidor

### Problema de concorrencia offline

Se o codigo fosse gerado localmente, dois tecnicos offline poderiam gerar o mesmo numero. Por isso, o `pedido_code` sera gerado **exclusivamente pelo banco de dados** no momento do INSERT, via trigger + sequence.

Pedidos criados offline simplesmente nao terao codigo ate serem sincronizados. Ao sincronizar, o servidor gera o codigo automaticamente.

---

### 1. Migracao no banco de dados

- Criar sequence `pedido_code_seq`
- Adicionar coluna `pedido_code` (nullable, pois pedidos offline ainda nao tem)
- Trigger `BEFORE INSERT` gera o codigo no formato `SP-` + 8 digitos
- Constraint `UNIQUE` no campo
- Preencher retroativamente os pedidos existentes que ja estao no banco

### 2. Offline DB (`src/lib/offline-db.ts`)

- Adicionar campo opcional `pedido_code?: string | null` na interface `OfflinePedido`
- Pedidos criados offline terao `pedido_code = null`

### 3. Sync de pedidos (`src/hooks/useOfflinePedidos.ts`)

- Incluir `pedido_code` no mapeamento ao baixar dados do servidor
- Na criacao offline, **nao gerar** codigo nenhum (campo fica null)
- Apos sincronizar, o servidor atribui o codigo e ele vem no proximo sync

### 4. Card do Kanban (`src/components/pedidos/PedidoKanban.tsx`)

- Exibir `pedido_code` no topo do card quando disponivel (fonte mono, cor neutra)
- Se `pedido_code` for null (pedido offline nao sincronizado), exibir badge "Pendente sync" ou nada

### 5. Listagem/Tabela (`src/pages/Pedidos.tsx`)

- Exibir `pedido_code` na tabela e nos detalhes do pedido
- Tratar null como "-" ou "Pendente"

---

### Detalhes tecnicos

**Migracao SQL:**
```text
CREATE SEQUENCE IF NOT EXISTS pedido_code_seq START 1;

ALTER TABLE pedidos ADD COLUMN pedido_code text;

-- Preencher pedidos existentes em ordem cronologica
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM pedidos WHERE pedido_code IS NULL
)
UPDATE pedidos SET pedido_code = 'SP-' || LPAD(
  (SELECT nextval('pedido_code_seq'))::text, 8, '0')
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
```

**Arquivos modificados:**
- Nova migracao SQL
- `src/lib/offline-db.ts` -- campo `pedido_code` opcional
- `src/hooks/useOfflinePedidos.ts` -- sincronizar campo, nao gerar offline
- `src/components/pedidos/PedidoKanban.tsx` -- exibir codigo no card
- `src/pages/Pedidos.tsx` -- exibir na tabela e detalhes

