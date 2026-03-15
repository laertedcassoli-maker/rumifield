
Diagnóstico rápido (com base no código atual):
1) O auto-consumo (Falha + ação com “Troca”) depende de peças da NC no Dexie (`nonconformityParts`). Após reinstalar, esse cache pode estar vazio; hoje o fluxo não faz fallback online sob demanda nesse ponto.
2) A adição manual ainda pode travar em “Adicionando” porque a mutation continua aguardando request remoto quando `navigator.onLine` está true (estado de rede pode estar “online” mesmo com conexão instável no app instalado).
3) O fluxo offline de `preventive_part_consumption` está incompleto no sync:
   - insert offline não envia todos os campos (ex.: `is_manual`, `notes`, `asset_unique_code`, `id`);
   - delete no sync usa só `exec_nonconformity_id` (manual usa `id`);
   - registros manuais offline estão usando `''` em `exec_item_id/exec_nonconformity_id` (deveria ser `null`).

Plano de implementação:
1) `src/components/preventivas/ChecklistExecution.tsx`
   - Criar helper `getNcPartsWithFallback(templateNcId)`:
     - tenta `offlineChecklistDb.getNonconformityParts`;
     - se vazio e online, busca no backend (`checklist_nonconformity_parts` + peça), salva no Dexie e retorna.
   - Usar esse helper em:
     - `createPartConsumptionForItemNCs`
     - branch de inclusão em `toggleNonconformityMutation`.
   - Resultado: Falha + Troca volta a gerar peça automaticamente mesmo após reinstalação.

2) `src/components/preventivas/ConsumedPartsBlock.tsx`
   - Tornar mutations de peças **local-first sempre** (não bloquear UI):
     - `addManualPartMutation`: grava primeiro no Dexie + fila; tenta sync em background se online.
     - `deleteManualPartMutation`, `updateStockSourceMutation`, `updateNotesMutation`, `updateAssetCodeMutation`: mesma estratégia local-first.
   - Para manual, salvar `exec_item_id` e `exec_nonconformity_id` como `null` (não string vazia).
   - Ajustar render para mesclar servidor + pendentes locais quando online (evita “sumir” até sincronizar).

3) `src/lib/offline-checklist-db.ts`
   - Evoluir `OfflinePartConsumption` para suportar campos reais usados na UI/sync:
     - `is_manual`, `notes`, `asset_unique_code`, `consumed_at`, `exec_item_id?: string | null`, `exec_nonconformity_id?: string | null`.
   - Atualizar `addPartConsumptionLocally` para enfileirar payload completo (incluindo `id` e campos opcionais).
   - Adicionar helper de update local com marcação `_pendingSync` para updates de source/notes/asset code.

4) `src/hooks/useOfflineChecklist.ts`
   - Corrigir `processSyncItem` para `preventive_part_consumption`:
     - insert/upsert por `id` (não por `exec_nonconformity_id,part_id`);
     - delete por `id` quando existir; fallback por `exec_nonconformity_id` para remoções automáticas;
     - marcar `partConsumptions` local como sincronizado após sucesso.
   - Resultado: fila de peças (manual e automática) sincroniza corretamente sem ficar “presa”.

Validação (fim a fim):
1) Offline: abrir checklist, marcar Falha + selecionar ação “Troca” + selecionar NC com peça vinculada → peça aparece imediatamente em “Peças”.
2) Offline: adicionar peça manual → botão não trava; dialog fecha; peça aparece na lista.
3) Voltar online: aguardar sync automático/forçar sync → recarregar tela e confirmar persistência no backend.
4) Reinstalar app + repetir cenário 1 com internet ativa → auto-consumo deve funcionar mesmo com cache local recém-limpo.

Detalhes técnicos (resumo):
- Não requer migração de banco.
- Correção é 100% em fluxo offline/sync de frontend.
- A causa principal é combinação de: cache de NC-parts não garantido + mutation não totalmente local-first + sync incompleto para `preventive_part_consumption`.
