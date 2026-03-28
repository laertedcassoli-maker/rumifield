

## Correções aprovadas: checklist estável + peças visíveis no mobile

### Fix 1 — AtendimentoPreventivo.tsx: substituir useOfflineQuery por useQuery

**Linhas 1-8**: Trocar import de `useOfflineQuery` por `useQuery` do tanstack. Remover imports de `offlineDb` e `offlineChecklistDb` (usados apenas na offlineFn e validação local).

**Linhas 65-223**: Substituir `useOfflineQuery` por `useQuery` com:
```ts
const { data: routeItem, isLoading, error, refetch } = useQuery({
  queryKey: ['route-item-attendance', itemId],
  queryFn: async () => { /* mesmo queryFn atual, linhas 67-151 */ },
  enabled: !!itemId,
  retry: 3,
  retryDelay: 1500,
  staleTime: 30_000,
  refetchOnWindowFocus: false,
});
```
- Remover completamente a `offlineFn` (linhas 154-222)
- Remover variáveis `isOfflineData` e `refetchOffline` (não mais retornadas)

**Linhas 581-598**: No estado de erro/não encontrado, adicionar botão "Tentar novamente" que chama `refetch()`:
```ts
if (error) {
  return (
    <div className="text-center py-12 px-4">
      <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500" />
      <h2 className="mt-3 font-semibold">Erro ao carregar dados</h2>
      <p className="text-sm text-muted-foreground mt-1">Verifique sua conexão</p>
      <Button onClick={() => refetch()} className="mt-4" size="sm">Tentar novamente</Button>
    </div>
  );
}
```

**Linhas 470-481** (validação Dexie): Remover checagem local de peças no Dexie (`offlineChecklistDb.partConsumptions.filter...`) — manter apenas a query ao backend, que é a fonte de verdade.

### Fix 2 — ChecklistExecution.tsx: refetchQueries para peças

Nas 4 ocorrências onde `invalidateQueries` é chamado para `['preventive-consumed-parts', preventiveId]` (linhas ~550, ~754, ~885, ~400), trocar por `refetchQueries` para forçar atualização imediata:

```ts
// DE:
queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });

// PARA:
queryClient.refetchQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
```

Mesma troca para `['part-consumption-coverage', preventiveId]`.

### Resumo
- 2 arquivos alterados
- Elimina dependência de Dexie para tela de atendimento preventivo
- Peças automáticas aparecem imediatamente na UI
- Checklist não some mais em oscilação de rede

