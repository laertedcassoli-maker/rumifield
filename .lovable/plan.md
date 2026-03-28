
Diagnóstico atualizado (causa raiz real)
- O problema não é “falta de gravação”: as peças estão no backend.
- O que falha é a consistência visual imediata no mobile por 2 pontos:
  1) `ChecklistExecution.tsx` faz `setQueryData` otimista, mas em seguida executa `refetchQueries` (com delay fixo), que pode retornar snapshot antigo e sobrescrever o cache otimista.
  2) `ConsumedPartsBlock.tsx` ainda decide a fonte de render por `isOnline`; se esse estado oscilar, ele ignora o cache online (onde a peça já foi inserida otimisticamente) e mostra lista vazia/local.

Abordagem diferente (sem depender de “Forçar atualização”)
- Trocar de “refetch agressivo” para “cache determinístico + reconciliação segura”.
- A UI passa a confiar no cache otimista imediato e só reconcilia sem sobrescrever cedo demais.

Plano de implementação

1) `src/components/preventivas/ChecklistExecution.tsx`
- Remover os `setTimeout(... refetchQueries ...)` nos fluxos:
  - `updateItemMutation.onSuccess`
  - `toggleActionMutation.onSuccess`
  - `toggleNonconformityMutation.onSuccess`
- Substituir por:
  - `queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId], refetchType: 'none' })`
  - `queryClient.invalidateQueries({ queryKey: ['part-consumption-coverage', preventiveId], refetchType: 'none' })`
- Manter `setQueryData` otimista atual (ele já está correto e imediato).

2) `src/components/preventivas/ConsumedPartsBlock.tsx`
- Não usar `isOnline` para decidir o que renderizar.
- Novo merge de dados:
  - base = `onlineParts` (ou último cache da query)
  - overlay = pendências locais (`_pendingSync`) não existentes na base
  - deduplicação por `id`
- Ajustar loading para não “piscar vazio” quando houver cache prévio.
- Manter `enabled: !!preventiveId` e `placeholderData` para preservar última lista enquanto reconcilia.

3) `src/components/preventivas/ConsumedPartsBlock.tsx` (mutações manuais)
- Em `addManualPartMutation` e `deleteManualPartMutation`, aplicar `setQueryData` local no `onSuccess` (inserir/remover item no cache imediatamente), além da invalidação sem refetch imediato.
- Isso elimina a janela em que peça manual existe no backend/local, mas ainda não aparece na UI.

Validação (mobile, sem botão de força)
1. Marcar NC + ação “Troca” em PREV-2026-00002 e confirmar peça imediata no bloco.
2. Adicionar peça manual e confirmar exibição imediata.
3. Sair da visita e clicar “Continuar” e validar que checklist + peças permanecem visíveis.
4. Repetir rápido (ações consecutivas) para garantir que não há regressão de race visual.

Impacto
- Sem mudança de regra de negócio.
- Sem depender de sync forçado.
- Foco total em consistência de UI no mobile, com atualização imediata e estável.
