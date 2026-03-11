

## Diagnóstico: Check-in trava no modo avião

### Causa raiz

O flag `isOffline` na mutation é derivado de `isRouteOffline || isItemsOffline` — que indica se os **dados foram carregados do Dexie**. Se o usuário carregou a página online e depois ativou o modo avião, `isOffline` permanece `false`.

Resultado: a mutation tenta o caminho online, o `fetch` fica pendurado (o service worker `NetworkFirst` também tenta a rede primeiro), e o timeout de 8 segundos pode não resolver porque o service worker não tem `networkTimeoutSeconds` configurado — ele espera indefinidamente pela rede antes de tentar o cache.

### Correções (2 arquivos)

**1. `src/pages/preventivas/ExecucaoRota.tsx`**

Nas mutations `checkinMutation` e `cancelMutation`, adicionar verificação de `navigator.onLine` junto com `isOffline`:

```typescript
// Linha 234 — de:
if (isOffline) {
// para:
if (isOffline || !navigator.onLine) {
```

Mesma alteração na `cancelMutation` (linha 313).

Isso garante que, mesmo que os dados tenham sido carregados online, se o dispositivo estiver sem rede no momento da ação, vai direto para o caminho offline sem esperar 8 segundos.

**2. `vite.config.ts`**

Adicionar `networkTimeoutSeconds: 3` ao `runtimeCaching` do service worker para que requisições GET ao Supabase também falhem rápido quando offline:

```typescript
runtimeCaching: [{
  urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
  handler: "NetworkFirst",
  options: {
    cacheName: "supabase-cache",
    networkTimeoutSeconds: 3, // <-- adicionar
    expiration: { ... },
    cacheableResponse: { ... },
  },
}],
```

