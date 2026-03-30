

## Correção definitiva: peças não exibidas no mobile

### Diagnóstico (após análise profunda)

O `setQueryData` otimista no `ChecklistExecution` atualiza o cache de `preventive-consumed-parts`. Porém, o `ConsumedPartsBlock` usa `staleTime: 0`, o que faz o React Query considerar QUALQUER dado no cache como "stale" e agendar um refetch imediato. Esse refetch compete com o `setQueryData` otimista e pode sobrescrever os dados antes de renderizar.

Além disso, o `setTimeout` de 3s que faz `refetchQueries` pode retornar dados do servidor antes que a replicação complete, limpando o cache otimista.

### Estratégia: polling curto + auto-expand

Em vez de depender da coordenação frágil de cache entre dois componentes, usar **polling automático** no `ConsumedPartsBlock` para garantir que os dados do servidor apareçam em poucos segundos, independentemente do estado do cache otimista.

### Alterações

**Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`**

1. Adicionar `refetchInterval: 5000` na query de peças — a cada 5 segundos, busca do servidor. Garante que mesmo se o cache otimista falhar, as peças aparecem em no máximo 5s.

2. Adicionar `staleTime: 2000` (em vez de 0) — evita que um refetch imediato sobrescreva o dado otimista recém-inserido pelo `setQueryData`.

3. **Auto-expand**: quando a lista de peças muda de 0 para >0 itens, expandir automaticamente o bloco (setar `isExpanded = true`). Isso garante que o usuário veja as peças sem precisar abrir manualmente o collapsible.

**Arquivo: `src/components/preventivas/ChecklistExecution.tsx`**

4. **Remover todos os `setTimeout` de 3s** que fazem `refetchQueries` para `preventive-consumed-parts`. O polling no ConsumedPartsBlock já garante a reconciliação — os timeouts só criam race conditions.

5. Manter o `cancelQueries` + `setQueryData` otimista como está (para feedback imediato quando funciona).

### Por que esta abordagem é diferente

- Todas as tentativas anteriores dependiam de **coordenação síncrona** entre dois componentes via cache React Query (setQueryData → observer → render). Isso é frágil em mobile.
- O polling é **independente** — funciona sem depender do `onSuccess` do outro componente. É a técnica mais confiável para dados que mudam por efeitos colaterais no backend.
- O `staleTime: 2000` protege o dado otimista de ser sobrescrito imediatamente.
- O auto-expand remove a necessidade de o usuário abrir manualmente o bloco para verificar se as peças foram geradas.

### Resumo
- 2 arquivos alterados
- Sem migration
- Sem mudança de regra de negócio
- Peças garantidas em até 5s no mobile (e instantâneas quando otimismo funciona)

