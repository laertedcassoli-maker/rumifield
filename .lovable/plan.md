

## Remover camada offline do ChecklistExecution.tsx

### Diagnóstico confirmado

O bug ocorre porque o `useEffect` na linha 388-406 limpa `optimisticActionSelections` e `optimisticNcSelections` **para todos os itens** sempre que `existingChecklist` muda. Ao selecionar uma ação no Item 2, o `onSuccess` invalida a query, o refetch produz um novo `existingChecklist`, o useEffect dispara e apaga as seleções otimistas do Item 1 antes que os dados reais cheguem — causando o "desmarcar" visual.

A solução proposta (remover toda a camada offline/Dexie e usar operações diretas no Supabase) é válida e elimina a raiz do problema. Sem estados otimistas de seleção, o componente sempre lê `selected_actions` e `selected_nonconformities` diretamente dos dados do servidor via `setQueryData` no `onSuccess`.

### Alterações no arquivo `src/components/preventivas/ChecklistExecution.tsx`

**Remover:**
1. Imports: `useOfflineChecklist`, `useOfflineQuery`, `offlineChecklistDb`
2. Estados: `optimisticNcSelections`, `optimisticActionSelections`
3. Hook: `const offlineChecklist = useOfflineChecklist()`
4. `useEffect` linhas 388-406 (clear optimistic selections)
5. `useEffect` linhas 256-262 (refetch offline template data)
6. Cache calls dentro dos queryFns (`cacheFullChecklist`, `cacheTemplateActions`, `cacheTemplateNonconformities`)
7. `offlineFn` de todas as queries
8. Referências a `offlineChecklist.isOnline`, `pendingCount`, `syncStatus`, `triggerSync`
9. `cacheChecklistData` no useEffect linha 383
10. Helpers Dexie: `itemHasTrocaAction`, `getNcPartsWithFallback`, `createPartConsumptionForItemNCs`, `removePartConsumptionForItemNCs` — reescrever usando Supabase direto

**Converter queries:**
- `existingChecklist`: `useOfflineQuery` → `useQuery` padrão
- `templateActions`: `useOfflineQuery` → `useQuery` padrão
- `templateNonconformities`: `useOfflineQuery` → `useQuery` padrão
- Remover `isChecklistOnline`, `refetchOffline`, `refetchActionsOffline`, `refetchNcsOffline`

**Reescrever mutations:**
- `updateItemMutation`: substituir `offlineChecklist.updateItem()` por UPDATE direto no Supabase. Manter `optimisticStatuses` e `setQueryData` no onSuccess (já existente)
- `toggleActionMutation`: substituir `offlineChecklist.toggleAction()` por INSERT/DELETE direto no Supabase + `setQueryData` no onSuccess para atualizar cache in-place (evita refetch que causa o bug)
- `toggleNonconformityMutation`: idem, INSERT/DELETE direto + `setQueryData`
- Part consumption: reescrever helpers para usar Supabase direto em vez de Dexie

**Atualizar onSuccess das mutations de toggle:**
- Em vez de `invalidateQueries` (que causa refetch e o bug), usar `setQueryData` para atualizar o cache in-place, similar ao que já é feito no `updateItemMutation`
- Fazer `invalidateQueries` apenas para `preventive-consumed-parts`

**Mapeamento dos blocos (linhas 933-951):**
- Remover referências a `optimisticActionSelections` e `optimisticNcSelections`
- Usar diretamente: `selectedActions: item.selected_actions?.map(a => a.template_action_id) || []`
- Usar diretamente: `selectedNonconformities: item.selected_nonconformities?.map(nc => nc.template_nonconformity_id) || []`

**Status display (getSyncStatusDisplay):**
- Simplificar: remover toda lógica de offline/pending/sync
- Manter apenas: "Salvando..." quando mutation pending, "Salvo HH:MM" quando salvo

**Guard de conexão:**
- No início de `toggleActionMutation`, `toggleNonconformityMutation` e `updateItemMutation`: verificar `navigator.onLine`, se false exibir toast e retornar

**Manter:**
- `optimisticStatuses` (feedback imediato ao mudar S/N/NA)
- Locks `processingActions` e `processingNonconformities`
- Toda lógica de UI, validação, progresso, conclusão
- `isChecklistOnline` substituído por `navigator.onLine` no guard de conexão
- Tela "offline sem cache" simplificada (sem Dexie, apenas mostra "sem conexão")

