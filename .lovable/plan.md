

## Fix: peças desaparecem após fechar e reabrir o app

### Causa raiz identificada

A query de peças (`preventive-consumed-parts`) tem configurações que impedem refetch adequado no remount:

1. `staleTime: 30_000` — dados considerados "frescos" por 30s, não refetch mesmo após remount
2. `refetchOnWindowFocus: false` — não refetch ao voltar para a aba
3. `placeholderData: (prev) => prev` — pode retornar dados antigos vazios
4. Merge-by-ID complexo no `queryFn` que lê o cache dentro do próprio fetch, criando dependência circular
5. `refetchType: 'none'` em todas as invalidações — dados marcados como stale mas nunca refetched em background

Combinação: ao fechar e reabrir, o cache está vazio, a query roda mas o merge-by-ID retorna array vazio antes dos dados do server chegarem, e o `placeholderData` não tem nada para mostrar.

### Correção: simplificar a query de peças

**Arquivo:** `src/components/preventivas/ConsumedPartsBlock.tsx`

1. **Remover merge-by-ID do queryFn** — a query retorna apenas dados do servidor, sem ler o cache dentro dela mesma
2. **Remover `staleTime: 30_000`** — usar `staleTime: 0` para sempre refetch no mount
3. **Remover `refetchOnWindowFocus: false`** — permitir refetch ao voltar
4. **Remover `placeholderData`** — evitar dados fantasma
5. **Manter `cancelQueries` + `setQueryData` nas mutações** — para feedback otimista imediato durante a sessão

**Arquivo:** `src/components/preventivas/ChecklistExecution.tsx`

6. **Trocar `refetchType: 'none'` por refetch com delay de 3s** — após mutação otimista, agendar refetch real para reconciliar com o backend (delay evita replica lag)

### Resumo
- A peça aparece instantaneamente via `setQueryData` (otimista) durante a sessão
- Ao reabrir, a query sempre busca do servidor e exibe os dados reais
- Refetch com delay de 3s garante reconciliação sem sobrescrever o estado otimista

