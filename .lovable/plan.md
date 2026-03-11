

## Diagnóstico: Check-in ainda trava offline

### Causa raiz

`navigator.onLine` e **sabidamente nao confiavel** em muitos dispositivos Android — pode retornar `true` mesmo em modo aviao. O banner "Voce esta offline" aparece porque o `useOfflineQuery` usa event listeners (`online`/`offline`) reativos, mas a mutation usa `navigator.onLine` como snapshot — que pode estar errado.

O `useOfflineQuery` ja retorna um `isOnline` reativo, mas o componente **nao o desestrutura**. Resultado: a mutation tenta o caminho online, o fetch fica pendurado ate o timeout de 8s, e o usuario ve "Salvando..." travado.

### Correcao (1 arquivo)

**`src/pages/preventivas/ExecucaoRota.tsx`**

1. Desestruturar `isOnline` de um dos `useOfflineQuery` (ex: o da rota):
```typescript
const { data: route, isLoading: routeLoading, isOfflineData: isRouteOffline, 
        refetchOffline: refetchRouteOffline, isOnline } = useOfflineQuery({...});
```

2. Substituir `navigator.onLine` por `isOnline` nas duas mutations e no `onSuccess`:

```typescript
// checkinMutation (linha 234)
if (isOffline || !isOnline) {

// checkinMutation onSuccess (linha 271)
if (isOffline || !isOnline) {

// cancelMutation mutationFn (linha ~313)
if (isOffline || !isOnline) {

// cancelMutation onSuccess (linha ~392)
if (isOffline || !isOnline) {
```

Isso usa o estado reativo (event-based) que ja detectou o modo aviao corretamente (o banner prova), em vez do snapshot nao confiavel do `navigator.onLine`.

