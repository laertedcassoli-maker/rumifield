

## Fix: nova COR não aparece na lista (invalidação sobrescreve update otimista)

### Causa raiz

No `onSuccess` do `NovaVisitaDiretaDialog.tsx`, a sequência é:
1. `setQueryData` — insere a nova visita otimisticamente ✅
2. `invalidateQueries({ queryKey: ['my-corrective-visits'] })` — dispara refetch imediato que busca dados do backend ❌

O refetch retorna dados potencialmente stale (replica lag no mobile), sobrescrevendo o insert otimista. É exatamente o mesmo bug que já corrigimos no check-in.

### Correção

**Arquivo:** `src/components/chamados/NovaVisitaDiretaDialog.tsx` (linha 213)

Adicionar `refetchType: 'none'` na invalidação de `my-corrective-visits`, mantendo apenas a marcação como stale (será reconciliado no próximo mount/focus):

```ts
// DE:
queryClient.invalidateQueries({ queryKey: ['my-corrective-visits'] });

// PARA:
queryClient.invalidateQueries({ 
  queryKey: ['my-corrective-visits'],
  refetchType: 'none',
});
```

A invalidação de `technical-tickets` pode manter refetch normal pois não afeta a lista visível.

### Impacto
- 1 linha alterada
- Nova COR aparece imediatamente via cache otimista
- Reconciliação acontece automaticamente no próximo foco/navegação (staleTime: 0)

