

## Offline Part Consumption para ChecklistExecution

### Problema
O side-effect de criação/deleção de `preventive_part_consumption` ao selecionar NCs e ações "Troca" só funciona online (`if (offlineChecklist.isOnline)`). Offline, o consumo de peças é perdido.

### Arquivos alterados

**1. `src/lib/offline-checklist-db.ts`** — Novas tabelas e métodos no Dexie

- Adicionar interfaces `OfflineNonconformityPart` e `OfflinePartConsumption`
- Declarar tabelas `nonconformityParts` e `partConsumptions` na classe
- Adicionar `version(4)` com todas as stores existentes + as duas novas
- Atualizar `clearAll()` para limpar as novas tabelas
- Adicionar métodos: `cacheNonconformityParts`, `getNonconformityParts`, `addPartConsumptionLocally`, `deletePartConsumptionByNcId`, `deletePartConsumptionByItemId`
- Expandir o tipo `ChecklistSyncQueueItem.table` para incluir `'preventive_part_consumption'`

**2. `src/hooks/useOfflineSync.ts`** — Cachear NC parts durante sync + processar sync queue

- No case `"checklists"` (linha ~241-287), após cachear template actions e NCs, adicionar loop para buscar `checklist_nonconformity_parts` por batch de `templateNcIds` e salvar via `cacheNonconformityParts`
- Os template NC IDs vêm dos NCs de template já cacheados no Dexie (`offlineChecklistDb.templateNonconformities`)

**3. `src/hooks/useOfflineChecklist.ts`** — Processar `preventive_part_consumption` no sync

- Adicionar case `'preventive_part_consumption'` no `processSyncItem`:
  - `insert` → `supabase.from('preventive_part_consumption').upsert(data, { onConflict: 'exec_nonconformity_id,part_id', ignoreDuplicates: true })`
  - `delete` → `supabase.from('preventive_part_consumption').delete().eq('exec_nonconformity_id', data.exec_nonconformity_id)`

**4. `src/components/preventivas/ChecklistExecution.tsx`** — Path offline nas mutations

- **`toggleNonconformityMutation`** (linha ~713): Adicionar bloco `else` ao `if (offlineChecklist.isOnline)`:
  - NC removida → buscar exec NC no Dexie por `exec_item_id + template_nonconformity_id`, deletar part consumptions associados
  - NC adicionada + `itemHasTrocaAction` → buscar exec NC, buscar `nonconformityParts` do Dexie, criar `addPartConsumptionLocally` para cada

- **`toggleActionMutation`** (linha ~627): Adicionar bloco `else` ao `if (offlineChecklist.isOnline)`:
  - Ação "Troca" removida → `deletePartConsumptionByItemId`
  - Ação "Troca" adicionada → buscar NCs selecionadas do item no Dexie, para cada NC buscar peças e criar consumo local

- **`itemHasTrocaAction`** (linha ~524): Expandir para funcionar offline — se `existingChecklist?.blocks` não tiver dados, consultar `offlineChecklistDb.checklistActions` por `exec_item_id` e filtrar por label contendo "troca"

### Fluxo offline completo

1. Sync online → `checklist_nonconformity_parts` cacheado no Dexie
2. Modo avião → técnico marca item como "Falhou"
3. Seleciona ação "Troca" → cria consumo local para NCs existentes
4. Seleciona NC → cria consumo local se "Troca" ativa
5. Remove NC → deleta consumo local
6. Remove "Troca" → deleta todo consumo do item
7. Volta online → sync queue processa inserts/deletes no servidor

