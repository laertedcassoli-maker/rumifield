

## Corrigir "Atendimento não encontrado" — race condition no useOfflineQuery

### Problema raiz
Quando `navigator.onLine` é `true` mas não há conectividade real (comum em campo), ocorre uma **race condition**:

1. Query do Supabase inicia com `enabled: true` → `isLoading = true` → mostra spinner
2. Após retry, query falha → `isError = true`, `isLoading = false`
3. **Antes do `useEffect` rodar o `offlineFn`**, o componente renderiza com `data: undefined` e `isLoading: false`
4. O componente vê `!routeItem` → mostra "Atendimento não encontrado"
5. Depois o `useEffect` roda, carrega dados do Dexie, mas o usuário já viu a tela de erro

```text
Timeline:
query loading ──► query error ──► render (data=undefined, loading=false) ──► effect runs offlineFn ──► data available
                                  ↑ AQUI mostra "não encontrado"
```

### Solução

**Arquivo: `src/hooks/useOfflineQuery.ts`**

Ajustar o cálculo de `isLoading` para considerar que quando o fallback **deveria** rodar mas ainda não rodou, é loading:

```typescript
// Calcular shouldFallback fora do useEffect para uso no return
const shouldFallback = enabled && (!isOnline || (query.isError && !query.isLoading));

// No return offline:
return {
  data: offlineData,
  isLoading: offlineLoading || (shouldFallback && offlineData === undefined) || (isOnline && query.isLoading),
  isOfflineData,
  isOnline,
  refetchOffline,
};
```

A adição de `(shouldFallback && offlineData === undefined)` garante que enquanto o fallback precisa rodar mas os dados ainda não chegaram, `isLoading = true`, evitando o flash de "não encontrado".

### Mudanças
- **1 arquivo**: `src/hooks/useOfflineQuery.ts` — adicionar `shouldFallback` como variável e incluí-la no cálculo de `isLoading`

