

## Persistência robusta de ordenação de blocos e itens de checklist

### Estado atual
- O `ChecklistEditor.tsx` já tem drag-and-drop funcionando com `@dnd-kit`
- Reordenação já persiste via `Promise.all` de updates individuais (linhas 504-541)
- **Problemas**: updates individuais sem transação, sem validação de pertencimento, sem recompactação na criação/exclusão, sem índices compostos, `order_index` começa em 0 (requisito é começar em 1)

### Plano

**1. Migração SQL** — Criar funções de banco + índices + triggers

```sql
-- Função: reordenar blocos em transação com validação
CREATE FUNCTION reorder_checklist_blocks(p_template_id uuid, p_ordered_ids uuid[])
-- Valida que todos IDs pertencem ao template
-- Atualiza order_index = posição (1-based) em loop
-- Executa como SECURITY DEFINER em transação implícita

-- Função: reordenar itens em transação com validação  
CREATE FUNCTION reorder_checklist_items(p_block_id uuid, p_ordered_ids uuid[])
-- Valida que todos IDs pertencem ao bloco
-- Atualiza order_index = posição (1-based)

-- Trigger AFTER DELETE: recompactar order_index nos blocos restantes
CREATE FUNCTION recompact_block_order() RETURNS trigger
-- UPDATE blocks SET order_index = subquery com row_number()

-- Trigger AFTER DELETE: recompactar order_index nos itens restantes
CREATE FUNCTION recompact_item_order() RETURNS trigger

-- Trigger BEFORE INSERT: atribuir order_index = max + 1
CREATE FUNCTION set_block_order_index() RETURNS trigger
CREATE FUNCTION set_item_order_index() RETURNS trigger

-- Índices compostos para performance
CREATE UNIQUE INDEX ON checklist_template_blocks(template_id, order_index)
CREATE UNIQUE INDEX ON checklist_template_items(block_id, order_index)
```

Os UNIQUE indexes serão `DEFERRABLE INITIALLY DEFERRED` para permitir reordenação dentro de transações.

**2. `ChecklistEditor.tsx`** — Usar RPCs ao invés de updates individuais

- `reorderBlocksMutation`: chamar `supabase.rpc('reorder_checklist_blocks', { p_template_id, p_ordered_ids })`
- `reorderItemsMutation`: chamar `supabase.rpc('reorder_checklist_items', { p_block_id, p_ordered_ids })`
- Remover `order_index` manual nas mutations de criação (triggers cuidam disso)
- Remover `order_index` manual na exclusão (trigger de recompactação cuida)
- Ajustar optimistic update para usar 1-based index

### Arquivos alterados
- **Migração SQL** — funções RPC + triggers + índices
- **`src/pages/preventivas/ChecklistEditor.tsx`** — usar RPCs, remover order_index manual

