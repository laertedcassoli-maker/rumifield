# Checklist de preventiva funcionando sem sinal

Religar o mecanismo offline que já existe no projeto na tela de execução do checklist de preventiva, para que nenhuma resposta do técnico em campo seja perdida quando falta sinal.

## O que muda para o técnico

- Marcar item (Sim/Não/NA), escrever observação, selecionar ação corretiva ou não-conformidade passa a funcionar sem internet: fica salvo no aparelho e sobe sozinho quando a rede volta.
- Aparece um aviso discreto no topo do checklist: "Offline" e "X pendente(s) de envio" quando há respostas aguardando envio, com botão de tentar enviar agora.
- Reabrir o checklist sem sinal (depois de já tê-lo aberto uma vez com sinal) mostra os blocos, itens, respostas e opções guardados no aparelho — inclusive as respostas ainda não enviadas — em vez da mensagem "Checklist não disponível offline".
- Peças consumidas continuam exigindo internet, como hoje: sem sinal, o bloco de peças segue indisponível e a resposta do item/ação/não-conformidade é salva normalmente.
- Iniciar um checklist novo continua exigindo internet, como hoje.
- Com internet, a tela se comporta exatamente como hoje.

## Detalhes técnicos

Arquivo único alterado: `src/components/preventivas/ChecklistExecution.tsx`.

1. Chamar `useOfflineChecklist()` e usar `updateItem`, `toggleAction`, `toggleNonconformity`, `cacheChecklistData`, `triggerSync`, `isOnline`, `syncStatus`, `pendingCount`.
2. `updateItemMutation`: remover o `if (!navigator.onLine) throw new Error('Sem conexão')` e gravar via `updateItem(itemId, { status, notes })`. Os `setQueryData` otimistas e `optimisticStatuses` continuam iguais. A regra de negócio de sair do status `N` continua valendo: online, mantém as deleções atuais no servidor (ações, não-conformidades e consumo vinculado); offline, as ações e não-conformidades do item são removidas pela fila (`toggleAction`/`toggleNonconformity` com `isCurrentlySelected: true`) e o consumo vinculado é limpo na primeira reabertura online.
3. `toggleActionMutation` / `toggleNonconformityMutation`: manter os locks (`processingActionsRef`/`processingNonconformitiesRef`), os retornos (`createdParts`, `removedParts`, `removedNcId`) e os `setQueryData`. A gravação da ação/NC passa pelo hook. Os efeitos de peça (`Troca` → criar/remover `preventive_part_consumption`) continuam só online — offline eles são pulados e a tela informa que as peças precisam de conexão; `createdParts` volta vazio, sem alterar `ConsumedPartsBlock.tsx`.
4. `useEffect` novo: quando `existingChecklist` carrega com sucesso e há conexão, chamar `cacheChecklistData(existingChecklist.blocks)` e gravar nas tabelas locais já existentes do Dexie (`checklists`, `checklistBlocks`, `checklistActions`, `checklistNonconformities`, `templateActions`, `templateNonconformities`) usando `put`/`bulkPut` direto — nenhuma alteração em `offline-checklist-db.ts` nem em `useOfflineChecklist.ts`.
5. Fallback de leitura: novo `useQuery` local (`['preventive-checklist-offline', preventiveId]`) que monta a árvore `checklist → blocks → items (+ ações/NCs selecionadas)` a partir do cache, preservando registros com `_pendingSync: true` e ignorando os marcados com `_operation: 'delete'`. Uma variável derivada `checklistData = existingChecklist ?? cachedChecklist` alimenta o resto do render; a tela de "não disponível offline" só aparece quando não há cache. Nesse modo o checklist entra como somente-envio-de-respostas: concluir checklist e peças continuam exigindo conexão (já é o comportamento atual).
6. Indicador: bloco compacto no cabeçalho do checklist com o mesmo padrão visual de `OfflineIndicator` (ícone `WifiOff`/`Cloud`, texto de status e badge `X pendente(s)`), sem substituir o `getSyncStatusDisplay()` existente.

## Fora de escopo

`ConsumedPartsBlock.tsx`, `createChecklistMutation`, `completeChecklistMutation`, schema/RLS de `preventive_checklists`/`preventive_checklist_items`, `useOfflineChecklist.ts` e `offline-checklist-db.ts`.

## Validação

Typecheck e build; teste no preview: marcar itens/ações/NCs com a rede desligada, religar e confirmar a sincronização e o contador voltando a zero; reabrir a tela offline e confirmar que blocos, respostas e opções aparecem; conferir que online nada mudou.
