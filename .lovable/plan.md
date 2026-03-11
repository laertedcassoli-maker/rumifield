

## Diagnóstico Final: Probe é enganado pelo cache do Service Worker

### Causa raiz confirmada

A função `isReallyOnline()` faz um `HEAD` request para `supabase.co/rest/v1/`. Em modo avião:

1. O Service Worker intercepta o request
2. Tenta a rede por 3 segundos (networkTimeoutSeconds)
3. Falha na rede, então **serve a resposta do cache** (pois `/rest/v1/` foi cacheado antes)
4. O probe recebe status 200 do cache → retorna `true` (online)
5. A mutation tenta o PATCH online → PATCH não tem cache → fica pendurado por mais 3 segundos
6. Total: ~6 segundos travado, e o fallback pode não funcionar corretamente

### Correção

Modificar `isReallyOnline()` para **bypassar o Service Worker** completamente:

```typescript
async function isReallyOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',        // bypass browser cache
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}
```

Porém, `cache: 'no-store'` **não garante bypass do Service Worker** — o SW intercepta antes do cache HTTP. A forma definitiva é adicionar um parâmetro único na URL para que o SW não encontre match no cache, ou usar uma URL que não case com o pattern do SW:

```typescript
// Opção mais robusta: URL com timestamp para não casar com cache do SW
await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/?_probe=${Date.now()}`, {
  method: 'HEAD',
  signal: controller.signal,
});
```

Mas mesmo isso pode casar com o pattern do SW (`/^https:\/\/.*\.supabase\.co\/.*/i`).

**Solução definitiva**: Usar um endpoint externo leve que o SW **não intercepta** (fora do pattern supabase), OU fazer o probe diretamente sem fetch — basta tentar um request curto a qualquer endpoint público:

A abordagem mais simples e eficaz: fazer o probe com `fetch` usando a **Navigation API** ou simplesmente usar `navigator.connection` quando disponível, mas como nenhum é confiável, a melhor solução é:

**Inverter a lógica: ir direto para offline e tentar online depois (offline-first).**

### Mudança de estratégia: Offline-First para mutations

Em vez de "testar se está online → tentar online → fallback offline", fazer:
1. **Sempre salvar localmente primeiro** (Dexie + sync queue) — instantâneo
2. **Tentar sincronizar imediatamente em background** se aparentemente online
3. UI mostra sucesso imediatamente

### Alterações em `ExecucaoRota.tsx`

```typescript
const checkinMutation = useMutation({
  mutationFn: async ({ itemId, lat, lon }) => {
    const now = new Date().toISOString();

    // 1. ALWAYS save locally first (instant)
    await checkinOffline(itemId, lat, lon, now);

    // 2. Try to sync online in background (best-effort, non-blocking)
    if (!isOffline && isOnline) {
      try {
        const updatePromise = (async () => {
          await supabase.from('preventive_route_items')
            .update({ checkin_at: now, checkin_lat: lat, checkin_lon: lon } as any)
            .eq('id', itemId);
          if (route?.status === 'planejada') {
            await supabase.from('preventive_routes')
              .update({ status: 'em_execucao' }).eq('id', id);
          }
          // Remove from sync queue if online succeeded
          // (sync queue handles duplicates via 23505)
        })();
        await withTimeout(updatePromise, ONLINE_TIMEOUT_MS);
      } catch {
        // Silently fail — sync queue will handle it later
        console.log('[checkin] Background sync failed, queued for later');
      }
    }
  },
  onSuccess: () => {
    refetchRouteOffline();
    refetchItemsOffline();
    if (!isOffline && isOnline) {
      queryClient.invalidateQueries({ queryKey: ['route-execution', id] });
      queryClient.invalidateQueries({ queryKey: ['route-execution-items', id] });
    }
    toast({ title: 'Check-in realizado!' });
    setCheckinItem(null);
  },
});
```

Mesma abordagem para `cancelMutation`.

Remover a função `isReallyOnline()` (não é mais necessária).

### O que isso resolve

- Check-in salva **instantaneamente** no Dexie — sem espera de probe/rede
- UI fecha o drawer e mostra sucesso em <100ms
- Sincronização online acontece em background (best-effort)
- Se falhar, a sync queue já existente cuidará quando voltar online
- Zero dependência de detecção de conectividade

