

## Corrigir UI não atualizando após check-in offline

### Problema
O `useOfflineQuery` carrega dados do Dexie apenas quando entra em modo offline (mudança de `isOnline`). Após o check-in offline:
1. `checkinOffline()` atualiza o Dexie corretamente
2. `onSuccess` chama `queryClient.invalidateQueries()`
3. Mas o React Query está **desabilitado** (`enabled: isOnline && ...`), então a invalidação não faz nada
4. O `useEffect` que lê do Dexie não re-executa porque suas dependências não mudaram
5. **Resultado**: toast de sucesso aparece, mas o card continua "Pendente"

### Solução
Adicionar um mecanismo de `refetch` ao `useOfflineQuery` para permitir re-leitura do Dexie sob demanda.

### Mudanças

**1. `src/hooks/useOfflineQuery.ts`**
- Adicionar um estado `offlineRefetchKey` (counter)
- Expor função `refetchOffline()` que incrementa o counter
- Adicionar `offlineRefetchKey` às dependências do `useEffect` que lê do Dexie
- Assim, quando `refetchOffline()` é chamado, o efeito re-executa o `offlineFn`

**2. `src/pages/preventivas/ExecucaoRota.tsx`**
- Desestruturar `refetchOffline` dos dois `useOfflineQuery` (route e items)
- No `onSuccess` do `checkinMutation` e `cancelMutation`: se `isOffline`, chamar `refetchOffline()` em vez de (ou além de) `invalidateQueries`

### Resultado
Após check-in/cancel offline, o Dexie é re-lido imediatamente e o card atualiza para "Em andamento" / "Cancelado".

