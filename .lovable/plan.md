

## Correções Offline PWA — Plano de Implementação

### Análise do código atual

Após revisar os 4 arquivos envolvidos, aqui está o status real de cada bug:

| Bug | Status | Arquivo |
|-----|--------|---------|
| #1 - `updateItemLocally` perde dados | **Confirmado** | `offline-checklist-db.ts` L142-158 |
| #2 - Race condition duplo-sync | **Confirmado, mas complexo** | `ChecklistExecution.tsx` L411-456, 598-649, 706+ |
| #3 - Check-in sem fila offline | **Já corrigido** no código atual | `ExecucaoRota.tsx` L263-296 |
| #4 - Sync checklists depende de preventivas | **Confirmado** | `useOfflineSync.ts` L184-187 |
| #5 - NetworkFirst 3s trava UI | **Confirmado** | `vite.config.ts` L57 |
| #6 - Sem sync na montagem | **Confirmado** | `useOfflineSync.ts` |

### Bug #3 — Já está corrigido

O `ExecucaoRota.tsx` já implementa o padrão offline-first para check-in:
- Linha 268: `await checkinOffline(itemId, lat, lon, now)` — salva local primeiro
- Linha 271-296: tenta Supabase com timeout, e em caso de falha apenas loga (dados já estão na fila)

Nenhuma alteração necessária.

### Bug #2 — Atenção especial

O código direto ao Supabase em `ChecklistExecution.tsx` não é apenas duplicação — ele faz **lógica de side-effects** crítica:
- Ao mudar status de `N` para outro: deleta ações, NCs e registros de `preventive_part_consumption`
- Ao toggle de ação "Troca": cria/remove consumo de peças
- Ao toggle de NC: cria/remove consumo de peças

**Simplesmente remover as chamadas Supabase quebraria essas funcionalidades no modo online.**

A correção correta: manter as chamadas de side-effects, mas **remover apenas o `update` duplicado do item** (linhas 418-421), já que `offlineChecklist.updateItem` já cuida disso via sync queue. Para actions e NCs, o padrão é o mesmo — manter os side-effects mas confiar no hook para a operação principal.

### Alterações por arquivo

**1. `src/lib/offline-checklist-db.ts`** — Bug #1
- Substituir `updateItemLocally`: usar `put` (upsert) quando item não existe no cache

**2. `src/components/preventivas/ChecklistExecution.tsx`** — Bug #2
- No `updateItemMutation`: remover o `supabase.from('preventive_checklist_items').update(...)` duplicado (L418-421), mantendo a lógica de cleanup de ações/NCs/consumo que vem depois
- No `toggleActionMutation`: remover o insert/delete direto de actions (L603-648), mantendo apenas a lógica de consumo de peças
- No `toggleNonconformityMutation`: remover o insert/delete direto de NCs, mantendo apenas a lógica de consumo de peças

**3. `src/hooks/useOfflineSync.ts`** — Bugs #4 e #6
- No case `"checklists"`: adicionar fallback para buscar IDs do servidor quando cache local vazio
- Adicionar `useEffect` de montagem para processar fila pendente imediatamente

**4. `vite.config.ts`** — Bug #5
- Separar `runtimeCaching` em duas entradas: dados ativos (NetworkFirst 1.5s) e dados de referência (CacheFirst 24h)

### Não será alterado
- `ExecucaoRota.tsx` (Bug #3 já resolvido)
- Background Sync do Workbox (Bug #6 parte 1) — a API `backgroundSync` do Workbox intercepta **fetch requests** que falham, não operações IndexedDB. Como as mutações offline salvam no Dexie (não fazem fetch), o `backgroundSync` do Workbox não ajudaria. O `useEffect` de montagem resolve o problema de forma mais adequada.

