

## Correção: Itens do checklist não atualizam offline

### Problema raiz

Quando offline, após o usuário clicar em OK/Falha/NA:

1. O item **é salvo corretamente no IndexedDB** (via `offlineChecklist.updateItem`)
2. A mutation "sucede" (não faz chamada ao servidor)
3. O `onSuccess` invalida queries do React Query — mas como o `useOfflineQuery` desabilita o React Query quando offline (`enabled: isOnline`), **nada acontece**
4. O dado offline em tela **nunca é relido do IndexedDB**, então a UI não reflete a mudança

O `useOfflineQuery` expõe um `refetchOffline()` que força releitura do IndexedDB, mas ele **não está sendo usado** no componente.

### Solução

**Arquivo: `src/components/preventivas/ChecklistExecution.tsx`**

1. Extrair `refetchOffline` do hook `useOfflineQuery` na query do checklist (linha 95)
2. No `onSuccess` da `updateItemMutation` (linha 452), chamar `refetchOffline()` quando offline
3. Aplicar o mesmo padrão nos callbacks de toggle de ações e não-conformidades (que provavelmente têm o mesmo bug)

```text
Fluxo corrigido:
  Clique OK/Falha/NA
    → updateItem salva no IndexedDB ✓
    → mutation sucede
    → onSuccess chama refetchOffline()
    → useOfflineQuery relê do IndexedDB
    → UI atualiza ✓
```

A correção é pontual: apenas adicionar a chamada `refetchOffline()` nos callbacks de sucesso das mutations que alteram dados do checklist.

