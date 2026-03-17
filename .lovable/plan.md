

## Permitir exclusão de peças automáticas (não apenas manuais)

### Problema
Na linha 824 do `ConsumedPartsBlock.tsx`, o botão de exclusão (lixeira) só aparece quando `part.is_manual === true`. Peças adicionadas automaticamente pelo checklist (Falha → Troca) têm `is_manual = false`, então ficam sem opção de remoção.

Além disso, a mutation `deleteManualPartMutation` (linha 311-315) filtra `.eq('is_manual', true)` no Supabase, impedindo a exclusão de peças automáticas mesmo que o botão existisse.

### Correção

**Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`**

1. **Mostrar botão de exclusão em todas as peças** (linha 824):
   - Remover a condição `part.is_manual` — manter apenas `!isCompleted`

2. **Renomear e ajustar a mutation de delete** (linhas 303-329):
   - Renomear `deleteManualPartMutation` → `deletePartMutation`
   - Remover o filtro `.eq('is_manual', true)` da query Supabase (linha 315)
   - Manter o restante da lógica (offline Dexie + sync queue) inalterado

3. **Atualizar referências** (linha 410):
   - `onDelete` já aponta para `deleteManualPartMutation.mutate` → atualizar para `deletePartMutation.mutate`

Nenhuma mudança no checklist — a exclusão da peça não afeta o registro de Falha/NC/Ação.

