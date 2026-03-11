

## Problema: Tela rola para o topo ao clicar OK/Falha

### Causa raiz

Na `onSuccess` do `updateItemMutation` (linha 458-465), `queryClient.invalidateQueries` força um refetch completo do checklist. Quando os novos dados chegam, o React re-renderiza todos os blocos/itens, causando scroll para o topo.

Offline, o `refetchOffline()` faz o mesmo efeito — recarrega os dados do Dexie e re-renderiza tudo.

### Correção

Parar de invalidar a query inteira no `onSuccess` do status update. Em vez disso, **atualizar o cache local do React Query diretamente** (via `queryClient.setQueryData`), mantendo a referência do DOM estável e sem scroll.

**Arquivo:** `src/components/preventivas/ChecklistExecution.tsx`

1. No `onSuccess` do `updateItemMutation`, substituir `invalidateQueries` por `setQueryData` que atualiza apenas o item modificado dentro da estrutura existente
2. Remover `refetchOffline()` do fluxo de status update (os dados já foram salvos localmente)
3. Manter `invalidateQueries` apenas para o caso de troca de status de `N` para outro (onde ações/NC são removidas e precisa atualizar)

Mudança concreta no `onSuccess`:
```typescript
onSuccess: (_, variables) => {
  // Update cache in-place instead of refetching (avoids scroll reset)
  queryClient.setQueryData(['preventive-checklist', preventiveId], (old: any) => {
    if (!old) return old;
    return {
      ...old,
      blocks: old.blocks?.map((block: any) => ({
        ...block,
        items: block.items?.map((item: any) => {
          if (item.id !== variables.itemId) return item;
          return {
            ...item,
            ...(variables.status !== undefined ? { status: variables.status } : {}),
            ...(variables.notes !== undefined ? { notes: variables.notes } : {}),
            answered_at: new Date().toISOString(),
            // Clear selections if changing away from N
            ...(variables.status && variables.status !== 'N' ? {
              selected_actions: [],
              selected_nonconformities: []
            } : {})
          };
        })
      }))
    };
  });
  setLastSavedAt(new Date());
  // Only do full refetch for consumed-parts (doesn't affect scroll)
  queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
},
```

Isso elimina o re-render completo e mantém a posição do scroll.

