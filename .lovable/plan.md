

## Rota não aparece em "Minhas Rotas" após finalizar planejamento

### Causa raiz

Ao finalizar o planejamento em `DetalheRota.tsx`, o `onSuccess` invalida a query `preventive-routes` (usada na página Rotas), mas **não invalida** a query `my-preventive-routes` (usada na página Minhas Rotas). Como a query `my-preventive-routes` filtra por `status IN ('planejada', 'em_execucao', 'finalizada')`, a rota recém-planejada só aparece quando o usuário força a sincronização manualmente.

### Correção

**Arquivo: `src/pages/preventivas/DetalheRota.tsx`**

Adicionar `queryClient.invalidateQueries({ queryKey: ['my-preventive-routes'] })` no `onSuccess` da mutação `updateRouteStatus` (linha ~323), junto com as invalidações já existentes.

```typescript
onSuccess: (_, newStatus) => {
  queryClient.invalidateQueries({ queryKey: ['preventive-route', id] });
  queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
  queryClient.invalidateQueries({ queryKey: ['my-preventive-routes'] });  // ← ADICIONAR
  queryClient.invalidateQueries({ queryKey: ['calendar-preventives'] });
  // ...
},
```

### Resumo
- 1 arquivo alterado, 1 linha adicionada
- Sem migration
- Corrige a falta de refresh automático na tela "Minhas Rotas"

