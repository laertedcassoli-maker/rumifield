

## Analise Ampla: Por que o Check-in trava offline

### Diagnostico

O problema e que **nenhum mecanismo de deteccao de conectividade e confiavel**:

1. **`navigator.onLine`** — retorna `true` em modo aviao em muitos dispositivos Android
2. **Eventos `online`/`offline`** — nem sempre disparam em PWAs/WebViews
3. **Service Worker `NetworkFirst` com cache** — quando o SW retorna resposta cacheada para GETs, o `useOfflineQuery` acha que esta online (`isOfflineData = false`)

Resultado: quando o app abre em modo aviao, o SW serve dados de cache para os GETs (rotas/fazendas), o hook retorna `isOnline = true` e `isOfflineData = false`. Na mutation de check-in, ambas condicoes `isOffline` e `!isOnline` sao `false`, entao tenta o caminho online. O PATCH (nao cacheado pelo SW) fica pendurado ate o timeout de 8 segundos.

Alem disso, mesmo apos o catch com fallback, o `onSuccess` chama `queryClient.invalidateQueries()` (caminho online), disparando novas requisicoes de rede que tambem falham.

### Solucao: Connectivity Probe real

Em vez de confiar em flags, fazer um **probe real de conectividade** antes de tentar operacoes online. Um `fetch` rapido com `AbortController` de 2 segundos.

### Alteracoes (1 arquivo)

**`src/pages/preventivas/ExecucaoRota.tsx`**

1. **Adicionar funcao `isReallyOnline()`** — faz um HEAD request ao supabase com 2s de timeout:
```typescript
async function isReallyOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}
```

2. **Reduzir `ONLINE_TIMEOUT_MS` de 8000 para 3000** — safety net mais curto

3. **Atualizar `checkinMutation`** — usar probe antes do caminho online:
```typescript
mutationFn: async ({ itemId, lat, lon }) => {
  const now = new Date().toISOString();

  // Fast path: known offline
  if (isOffline || !isOnline) {
    await checkinOffline(itemId, lat, lon, now);
    return;
  }

  // Real connectivity check
  const reallyOnline = await isReallyOnline();
  if (!reallyOnline) {
    await checkinOffline(itemId, lat, lon, now);
    return;
  }

  try {
    await withTimeout(updatePromise, ONLINE_TIMEOUT_MS);
  } catch (err) {
    // ... fallback existente
  }
}
```

4. **Atualizar `onSuccess` do checkin** — usar o mesmo probe ou flag:
```typescript
onSuccess: () => {
  // Always refetch from offline after mutation
  // (invalidateQueries will work when truly online)
  refetchRouteOffline();
  refetchItemsOffline();
  if (!isOffline && isOnline) {
    queryClient.invalidateQueries({ queryKey: ['route-execution', id] });
    queryClient.invalidateQueries({ queryKey: ['route-execution-items', id] });
  }
  toast({ title: 'Check-in realizado!' });
  setCheckinItem(null);
}
```

5. **Mesmas alteracoes no `cancelMutation`**

### O que isso resolve

- Probe real de 2s detecta falta de rede independente de `navigator.onLine` ou eventos
- Tempo maximo ate fallback: 2s (probe) vs 8s anterior
- `onSuccess` sempre faz `refetchOffline` para garantir UI atualizada com dados locais
- `invalidateQueries` so roda como bonus quando realmente online

