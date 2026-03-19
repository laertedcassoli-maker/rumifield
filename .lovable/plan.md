

## Corrigir duplicação de checklist template — incluir não-conformidades e peças

### Arquivo: `src/pages/preventivas/Checklists.tsx`
### Função: `duplicateTemplateMutation`

### Alterações

**1. Expandir o select da estrutura original** (linha ~103)

Adicionar `nonconformities:checklist_item_nonconformities(*)` ao select dos items, ao lado de `actions`.

**2. Duplicar não-conformidades** — após o loop de ações corretivas (~linha 137)

Para cada `nc` em `item.nonconformities`:
- Insert em `checklist_item_nonconformities` com campos: `item_id: newItem.id`, `nonconformity_label: nc.nonconformity_label`, `order_index: nc.order_index`, `active: nc.active`
- Para cada não-conformidade criada, buscar peças vinculadas em `checklist_nonconformity_parts` onde `nonconformity_id = nc.id`
- Insert cada peça com: `nonconformity_id: newNc.id`, `part_id: part.part_id`, `default_quantity: part.default_quantity`

### Campos (inferidos dos types)
- `checklist_item_nonconformities`: `item_id`, `nonconformity_label`, `order_index`, `active`
- `checklist_nonconformity_parts`: `nonconformity_id`, `part_id`, `default_quantity`

Nenhuma outra alteração na função.

