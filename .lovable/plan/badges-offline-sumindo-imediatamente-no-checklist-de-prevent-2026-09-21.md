# Badges offline sumindo imediatamente no checklist de preventiva

Ajuste de acompanhamento da entrega "Checklist de preventiva funcionando sem sinal": quando o checklist abre já offline (sem ter carregado online antes), os badges de ação corretiva e não-conformidade removidas continuam aparecendo na tela, embora o dado já esteja gravado corretamente na fila local. A query de fallback relê do Dexie só no primeiro carregamento, e as gravações não a invalidam.

## O que muda

Na tela de execução do checklist, após qualquer resposta de item, ação corretiva ou não-conformidade, o cache local é relido imediatamente — offline, os badges de itens removidos somem da tela na hora, sem recarregar. Online, nada muda, porque o dado do servidor continua tendo prioridade sobre o cache.

## Detalhes técnicos

Arquivo único alterado: `src/components/preventivas/ChecklistExecution.tsx` (~2004 linhas).

A query de fallback offline já existe (queryKey `['preventive-checklist-offline', preventiveId]`, linha ~181) e monta a árvore a partir do Dexie. Faltam as invalidações após as gravações.

Adicionar em cada um dos três `onSuccess` uma linha extra:

1. `updateItemMutation` — `onSuccess` na linha ~789:
   `queryClient.invalidateQueries({ queryKey: ['preventive-checklist-offline', preventiveId] });`
2. `toggleActionMutation` — `onSuccess` na linha ~1039:
   `queryClient.invalidateQueries({ queryKey: ['preventive-checklist-offline', preventiveId] });`
3. `toggleNonconformityMutation` — `onSuccess` na linha ~1238:
   `queryClient.invalidateQueries({ queryKey: ['preventive-checklist-offline', preventiveId] });`

Nada mais muda nas mutations nem em nenhum outro arquivo: `useOfflineChecklist.ts` e `offline-checklist-db.ts` permanecem intactos; `createChecklistMutation`, `ConsumedPartsBlock.tsx` e o restante da tela não são tocados.

Efeito: a invalidação relê o Dexie após cada gravação (local ou online), então `cachedChecklist` reflete o estado mais recente. Como `checklistData = existingChecklist ?? cachedChecklist`, quando o servidor responde (online) o comportamento é idêntico ao de hoje.

## Validação

Typecheck (`bunx tsgo --noEmit`) e build. Teste no preview simulando modo avião: abrir o checklist offline, marcar um item que estava "N" com ação/NC selecionada, trocar para "S" e confirmar que os badges somem imediatamente; religar a conexão e confirmar a sincronização.
