

## Correções do timer da OS em DetalheOSDialog.tsx

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

### Correção 1 — Estado otimista para início imediato do timer

Adicionar estado `optimisticTimeEntry` (linha ~108) e derivar `effectiveTimeEntry`:

```typescript
const [optimisticTimeEntry, setOptimisticTimeEntry] = useState<TimeEntry | null>(null);
const effectiveTimeEntry = optimisticTimeEntry ?? activeTimeEntry;
```

No `startTimerMutation.mutationFn` (linha 366), **antes** de qualquer chamada ao servidor, criar o entry otimista:

```typescript
const optimistic: TimeEntry = {
  id: crypto.randomUUID(),
  work_order_id: workOrder.id,
  user_id: user.id,
  started_at: new Date().toISOString(),
  ended_at: null,
  duration_seconds: null,
  status: 'running',
};
setOptimisticTimeEntry(optimistic);
```

No `onSettled` da mutation (novo callback), limpar o otimista após o refetch completar:

```typescript
onSettled: () => { setOptimisticTimeEntry(null); }
```

No `onError`, fazer rollback imediato: `setOptimisticTimeEntry(null)`.

### Correção 2 — Deps estáveis no useEffect do timer

Alterar o `useEffect` do timer (linha 346-362) para usar `effectiveTimeEntry` com deps estáveis:

```typescript
useEffect(() => {
  const currentEntry = effectiveTimeEntry;
  if (currentEntry?.status === 'running') {
    const startedAt = new Date(currentEntry.started_at).getTime();
    const interval = setInterval(() => {
      const runningTime = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedTime(localTotalSeconds + runningTime);
      setCurrentSessionTime(runningTime);
    }, 1000);
    return () => clearInterval(interval);
  } else {
    setElapsedTime(localTotalSeconds);
    setCurrentSessionTime(0);
  }
}, [effectiveTimeEntry?.id, effectiveTimeEntry?.status, localTotalSeconds]);
```

Usar `.id` e `.status` como deps evita recriar o interval a cada refetch.

### Correção 3 — Remover refetchInterval do useQuery

Linha 164: remover `refetchInterval: (query) => query.state.data?.status === 'running' ? 1000 : false` e substituir por `staleTime: 30000`. O timer local já calcula o tempo via `setInterval`; polling a cada 1s é desnecessário e causa instabilidade.

### Ajuste no stopTimerMutation

Linha 444: `stopTimerMutation` usa `activeTimeEntry` diretamente. Alterar para usar `effectiveTimeEntry` para que funcione mesmo enquanto o estado otimista estiver ativo.

