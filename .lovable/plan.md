

## Correção: segunda peça em diante não aparece (polling sobrescreve cache otimista)

### Causa raiz

O `refetchInterval: 5000` no `ConsumedPartsBlock` faz polling a cada 5 segundos. O `staleTime: 2000` protege o cache otimista por apenas 2 segundos. Quando o polling dispara e o servidor ainda não replicou a segunda peça, a resposta do servidor (com apenas a primeira peça) **sobrescreve** o cache otimista que continha a segunda peça. Resultado: a primeira aparece (já existia no servidor), mas a segunda desaparece até o próximo poll trazer dados atualizados.

### Estratégia: pausar polling após mutação

Após cada `setQueryData` otimista no `ChecklistExecution`, comunicar ao `ConsumedPartsBlock` para **pausar o polling por 15 segundos** — tempo suficiente para o servidor replicar. Isso é feito via React Query metadata (sem precisar de contexto compartilhado).

### Alterações

**Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`**

1. Adicionar um `state` para controlar pausa do polling: `const [pollPaused, setPollPaused] = useState(false)`.

2. Trocar `refetchInterval: 5000` por `refetchInterval: pollPaused ? false : 5000` — desabilita polling quando pausado.

3. Escutar evento customizado no `queryClient` via `useEffect` que monitora mudanças no cache de `preventive-consumed-parts`. Quando detectar items com `_optimistic: true`, pausar polling por 15s e depois retomar (com `setTimeout`).

**Arquivo: `src/components/preventivas/ChecklistExecution.tsx`**

4. Nos `onSuccess` das mutações (`toggleActionMutation` e `toggleNonconformityMutation`), após o `setQueryData` otimista, **também aumentar o `staleTime` temporariamente** usando `queryClient.setQueryDefaults` — ou, mais simples: após o `cancelQueries`, setar os dados otimistas e **não invalidar** (remover as linhas `invalidateQueries({ refetchType: 'none' })`). Sem invalidação, o dado fica "fresh" pelo `staleTime: 2000`, e o polling no ConsumedPartsBlock estará pausado por 15s.

5. Após os 15s de pausa, o polling retoma e traz os dados reais do servidor (já replicados), reconciliando naturalmente.

### Implementação concreta

**ConsumedPartsBlock.tsx:**
```tsx
const [pollPausedUntil, setPollPausedUntil] = useState(0);
const isPollPaused = Date.now() < pollPausedUntil;

// Na query:
refetchInterval: isPollPaused ? false : 5000,
staleTime: isPollPaused ? 15000 : 2000,

// Escutar cache updates com _optimistic flag:
useEffect(() => {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.query?.queryKey?.[0] === 'preventive-consumed-parts' && 
        event?.query?.queryKey?.[1] === preventiveId &&
        event?.type === 'updated') {
      const data = event.query.state.data as any[];
      if (data?.some(p => p._optimistic)) {
        setPollPausedUntil(Date.now() + 15000);
      }
    }
  });
  return unsubscribe;
}, [queryClient, preventiveId]);
```

**ChecklistExecution.tsx:**
- Manter `cancelQueries` + `setQueryData` como está.
- **Remover** as linhas `invalidateQueries({ refetchType: 'none' })` para `preventive-consumed-parts` nos `onSuccess` de `toggleActionMutation` e `toggleNonconformityMutation`. Isso evita marcar o cache como stale, permitindo que o pollPaused proteja os dados otimistas.

### Resumo
- 2 arquivos alterados
- Sem migration
- Polling pausa automaticamente por 15s após atualização otimista
- Servidor tem tempo de replicar antes do próximo fetch
- Segunda, terceira... N peças permanecem visíveis imediatamente

