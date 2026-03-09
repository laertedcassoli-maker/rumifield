

## Corrigir checklist travado em "Iniciando checklist..." offline

### Problema
`ChecklistExecution.tsx` usa `useQuery` padrão para buscar o checklist existente (linha 93). Offline, a query fica carregando indefinidamente. Além disso, se não encontra checklist, tenta criar um via mutação no Supabase — que também falha offline.

### Causa raiz
- A query `preventive-checklist` usa `useQuery` sem fallback Dexie
- O auto-start tenta `createChecklistMutation.mutate()` que requer Supabase
- O `offlineChecklistDb` já cacheia **items**, **actions** e **nonconformities**, mas **não cacheia** a estrutura do checklist (registro principal + blocos)

### Solução

**1. `src/lib/offline-checklist-db.ts`** — Adicionar tabelas para cache da estrutura completa:
- Nova tabela `checklists` (id, preventive_id, template_id, status, template_name)
- Nova tabela `checklistBlocks` (id, checklist_id, block_name_snapshot, order_index)
- Método `cacheFullChecklist(checklist)` que salva tudo
- Método `getCachedChecklist(preventiveId)` que reconstrói a estrutura completa juntando blocks → items → actions/nonconformities

**2. `src/components/preventivas/ChecklistExecution.tsx`** — Converter para offline:
- Substituir `useQuery` por `useOfflineQuery` na query `preventive-checklist`
- `offlineFn`: buscar do Dexie via `getCachedChecklist(preventiveId)`
- Quando online e dados chegam, chamar `cacheFullChecklist()` para salvar estrutura
- No auto-start (useEffect linha 335): adicionar condição `offlineChecklist.isOnline` — não tentar criar checklist offline
- Quando offline sem checklist cacheado: mostrar mensagem "Checklist não disponível offline" ao invés de spinner infinito

**3. Queries secundárias** (`templateActions`, `templateNonconformities`):
- Já estão condicionadas a `enabled: !!existingChecklist`
- Adicionar fallback: quando offline, as actions/nonconformities já estão no Dexie `checklistActions`/`checklistNonconformities`, reconstruídas pelo `getCachedChecklist`

### Arquivos alterados
- `src/lib/offline-checklist-db.ts` — 2 novas tabelas + métodos de cache/leitura
- `src/components/preventivas/ChecklistExecution.tsx` — converter query principal + skip auto-start offline

