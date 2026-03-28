
Objetivo: eliminar a dependência do botão “Forçar sync” para exibir peças no bloco de consumo da preventiva, mantendo a lógica de negócio atual.

Diagnóstico confirmado (com base no código + banco):
- As peças estão sendo gravadas corretamente no backend para a PREV-2026-00001.
- O problema está na atualização da UI: o bloco de peças depende de refetch e fallback local; quando o refetch retorna snapshot antigo (lag de leitura) ou falha pontual, a lista fica vazia até um novo ciclo de sync manual.

Escopo (somente frontend, sem alterar regra de negócio):
1) `src/components/preventivas/ChecklistExecution.tsx`
2) `src/components/preventivas/ConsumedPartsBlock.tsx`

Plano de implementação

1) Tornar a atualização de peças “determinística” no `ChecklistExecution`
- Nos fluxos que criam/removem consumo automático (`toggleActionMutation`, `toggleNonconformityMutation`, e limpeza em `updateItemMutation`), retornar do `mutationFn` os IDs/linhas de peças afetadas.
- No `onSuccess`, aplicar `queryClient.setQueryData(['preventive-consumed-parts', preventiveId], ...)` para inserir/remover imediatamente no cache.
- Manter reconciliação com backend, mas sem sobrescrever instantaneamente com snapshot potencialmente atrasado:
  - `invalidateQueries(..., refetchType: 'none')`
  - `refetchQueries(...)` com pequeno delay (ex.: 1.5–2s) para reconciliar após propagação.

2) Blindar renderização no `ConsumedPartsBlock`
- Ajustar composição da lista para não cair em “lista vazia” quando query online oscilar:
  - Priorizar último cache online válido + pendências locais.
  - Usar fallback local completo apenas quando realmente offline.
- Manter `enabled: !!preventiveId` (já corrigido).
- Adicionar estabilidade de query (`staleTime`, `retry`, `refetchOnWindowFocus: false`) para reduzir re-fetch agressivo no mobile.
- Garantir deduplicação por `id` ao mesclar online/local.

3) QA focado no bug reportado (mobile)
- Cenário A: marcar NC com ação “Troca” e validar exibição imediata da peça sem clicar em sync.
- Cenário B: sair da visita e “Continuar” e validar que peças continuam visíveis.
- Cenário C: repetir com 2+ NCs no mesmo item para validar merge/deduplicação.
- Cenário D: validar que remoção de NC/ação remove peça da UI imediatamente e reconcilia com backend.

Detalhes técnicos (resumo)
- Sem migration de banco.
- Sem mudança de layout/estilo.
- Sem alterar regra de geração de peças (NC + ação “Troca”).
- Ajuste é de sincronização visual/cache React Query para evitar dependência de sync manual.
