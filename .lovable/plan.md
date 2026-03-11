

## Corrigir duplicação de itens do checklist para incluir peças

### Diagnóstico

A função `duplicateItemMutation` em `ChecklistEditor.tsx` (linhas 290-351) já duplica:
- O item em si
- Ações corretivas (`checklist_item_corrective_actions`)
- Não-conformidades (`checklist_item_nonconformities`)

Porém **não duplica** as peças associadas, que estão nas tabelas:
- `checklist_action_parts` (peças vinculadas a ações) — tabela existe mas não é usada no editor
- `checklist_nonconformity_parts` (peças vinculadas a não-conformidades) — usada ativamente

### Correção

**Arquivo:** `src/pages/preventivas/ChecklistEditor.tsx`, dentro de `duplicateItemMutation.mutationFn`

Após duplicar as ações e não-conformidades, buscar e copiar as peças de cada uma:

1. **Ações corretivas** — para cada ação do item original, buscar peças em `checklist_action_parts` e inserir novos registros apontando para a ação duplicada correspondente.

2. **Não-conformidades** — para cada NC do item original, buscar peças em `checklist_nonconformity_parts` e inserir novos registros apontando para a NC duplicada correspondente.

Mudança concreta no fluxo:
- Ao inserir ações, retornar os IDs dos novos registros (`.select()`)
- Mapear cada ação original → ação duplicada pelo índice
- Buscar `checklist_action_parts` de cada ação original
- Inserir cópias com `action_id` = nova ação
- Repetir o mesmo para não-conformidades e `checklist_nonconformity_parts`

A query atual do template não carrega peças, então também precisa incluir `parts:checklist_action_parts(*)` dentro de actions e `parts:checklist_nonconformity_parts(*)` dentro de nonconformities na query principal (linhas 92-116).

### Escopo de mudança

Um único arquivo: `src/pages/preventivas/ChecklistEditor.tsx`
- Expandir a query do template para incluir peças nas ações e NCs
- Atualizar tipos locais `ChecklistAction` e `ChecklistNonconformity` para incluir `parts`
- Modificar `duplicateItemMutation` para copiar peças após duplicar ações/NCs

