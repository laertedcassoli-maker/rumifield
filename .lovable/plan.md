

## Correção: NCs não aparecem imediatamente ao marcar "Falha"

### Causa raiz real

O problema **não é** que `hasFailureDetails` usa `item.status` em vez do status otimista — linha 929 já mapeia `status: optimisticStatuses[item.id] ?? item.status` nos blocos.

O problema é de **timing entre renders**:

1. Clique em "Falhou" → `onChange` dispara sincronamente
2. `mutate()` é chamado → `mutationFn` roda **async**
3. `setExpandedItems` roda **sincronamente** no handler (L1194) → dispara re-render
4. Nesse re-render, `optimisticStatuses` ainda NÃO tem o novo status (foi setado dentro do `mutationFn` async na L414)
5. `item.status` ainda é o antigo → `hasFailureDetails = false` → Collapsible não renderiza
6. Só no próximo render (quando `setOptimisticStatuses` finalmente executa dentro do mutationFn) é que aparece

### Solução

Mover `setOptimisticStatuses` do `mutationFn` para o `onChange` handler, antes de `mutate()`. Assim ambos state updates (`setOptimisticStatuses` + `setExpandedItems`) acontecem no mesmo batch síncrono do React.

### Alterações em `ChecklistExecution.tsx`

**1. No `onChange` do `ChecklistItemStatusButtons` (~L1177-1196):**
- Adicionar `setOptimisticStatuses(prev => ({ ...prev, [item.id]: status }))` como primeira linha do handler
- Manter `setExpandedItems` e `mutate()` como estão

**2. No `mutationFn` do `updateItemMutation` (~L412-415):**
- Remover o `setOptimisticStatuses` de dentro do `mutationFn` (já foi feito no handler)

Resultado: ambos `setOptimisticStatuses` e `setExpandedItems` executam sincronamente no mesmo evento de clique → React faz um único re-render com `item.status === 'N'`, `hasFailureDetails === true`, e `isExpanded === true`. O bloco de NCs aparece imediatamente, já expandido.

