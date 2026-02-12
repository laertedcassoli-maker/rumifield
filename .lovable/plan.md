

## Editar Pedidos em Status "Solicitado" com Historico

### Contexto Atual
- Edicao de pedidos so funciona para rascunhos (status "rascunho")
- Nao existe tabela de historico/auditoria de alteracoes em pedidos
- Roles com permissao de gestao: `admin` e `coordenador_logistica` (variavel `canManagePedidos`)

### Solucao Proposta

**1. Criar tabela de auditoria `pedido_item_log`** (migracao SQL)

Registra cada alteracao feita nos itens de um pedido:
- `id`, `pedido_id`, `peca_id`, `peca_codigo`, `peca_nome`
- `action`: enum ('added', 'removed', 'qty_changed')
- `old_quantity`, `new_quantity`
- `user_id`, `created_at`

Isso preserva o historico completo do pedido original e todas as alteracoes subsequentes.

RLS: leitura para autenticados, insercao apenas pelo proprio usuario.

**2. Cancelamento de item (soft delete)**

Em vez de deletar fisicamente o `pedido_itens`, adicionar uma coluna `cancelled_at` (timestamp, nullable) na tabela `pedido_itens`. Itens cancelados:
- Permanecem no banco para historico
- Sao exibidos com visual de riscado/opacidade reduzida
- Nao contam no total de pecas/unidades
- Geram registro no `pedido_item_log` com action = 'removed'

**3. UI de edicao para pedidos "solicitado"**

No dialog de detalhes do pedido (`viewingPedido`), quando `canManagePedidos && status === 'solicitado'`:
- Botao "Editar Pedido" no topo
- Ao ativar edicao:
  - Cada item ganha um botao de cancelar (icone X com confirmacao)
  - Aparece botao "Adicionar Item" com o mesmo seletor de pecas usado na criacao
  - Alteracao de quantidade inline
  - Botao "Salvar Alteracoes" e "Cancelar Edicao"
- Cada acao gera um registro no `pedido_item_log`

### Detalhes Tecnicos

**Migracao SQL:**
```sql
-- Coluna soft-delete em pedido_itens
ALTER TABLE pedido_itens ADD COLUMN cancelled_at timestamptz DEFAULT NULL;
ALTER TABLE pedido_itens ADD COLUMN cancelled_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Tabela de log
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
-- Policies: leitura autenticados, insercao por admin/coord ou dono
```

**Arquivos a modificar:**
- `src/pages/Pedidos.tsx` - Adicionar modo de edicao no dialog de detalhes para pedidos "solicitado", com acoes de cancelar item, adicionar item e alterar quantidade. Cada acao grava no `pedido_item_log` via Supabase.
- Ajustar contadores para ignorar itens com `cancelled_at IS NOT NULL`

**Fluxo do usuario:**
1. Abre detalhes de um pedido "solicitado"
2. Clica "Editar"
3. Pode cancelar itens (ficam riscados), adicionar novos, alterar quantidades
4. Ao salvar, todas as alteracoes sao persistidas e logadas
5. Historico acessivel no proprio detalhe do pedido (secao "Historico de Alteracoes")
