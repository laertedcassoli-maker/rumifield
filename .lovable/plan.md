# Treinamento combinado nas visitas (offline-first)

Permitir que, durante uma visita corretiva, preventiva ou etapa de instalação, o responsável marque que aquele atendimento também foi um treinamento: escolhe um checklist existente, marca item a item, informa nome e telefone de quem foi treinado e conclui — tudo funcionando sem sinal e sincronizando depois.

## O que o usuário verá

Nas três telas de execução aparece uma seção "Combinar com Treinamento" (fechada por padrão). Ao ativar:

1. Seleção do checklist (modelos ativos já cadastrados).
2. Campos "Nome do responsável treinado" e "Telefone".
3. Lista de blocos e itens do checklist escolhido, cada item com caixa de marcação e campo opcional de observação.
4. Botão "Concluir Treinamento" (exige nome e telefone preenchidos).

O treinamento criado aparece normalmente nas abas "Treinamentos" e "Clientes" do módulo Treinamento, já vinculado ao cliente e ao responsável da visita em andamento — sem abrir o formulário avulso. Sem internet, tudo é salvo no aparelho com indicação de pendência e sincroniza automaticamente quando a conexão voltar.

## Detalhes técnicos

### 1. Banco de dados

Migration criando `public.training_checklist_responses` (id, training_visit_id → training_visits ON DELETE CASCADE, checklist_template_item_id → checklist_template_items, checked boolean default false, notes, created_at, updated_at) com:

- índice em (training_visit_id, checklist_template_item_id) e restrição única no par (garante idempotência 23505 no reenvio da fila);
- GRANT para authenticated e service_role;
- RLS habilitada, mesma filosofia de `training_visits`: leitura e escrita para authenticated (USING/WITH CHECK true);
- trigger de `updated_at`.

Regenerar `types.ts` depois da migration.

### 2. Camada offline

`src/lib/offline-checklist-db.ts` — bump de versão do Dexie com novos stores:

- `trainingVisits`: espelha as colunas de training_visits + `_pendingSync`/`_localId`;
- `trainingChecklistResponses`: espelha as colunas novas + `_pendingSync`/`_localId`;
- `trainingTemplates`: cache leve de checklist_templates ativos com seus blocos e itens (necessário para renderizar o checklist sem sinal; preenchido quando a tela é aberta online).

O tipo `ChecklistSyncQueueItem['table']` passa a aceitar `training_visits` e `training_checklist_responses`.

`src/hooks/useOfflineTrainingChecklist.ts` (novo), seguindo `useOfflineChecklist.ts`:

- IDs gerados no cliente (`crypto.randomUUID()`) para que visita e respostas cheguem consistentes ao servidor;
- grava local com `_pendingSync: true` → `addToSyncQueue` → tenta sincronizar se online (debounce 2s);
- upsert com `onConflict: 'id'` (visita) e no par visita/item (respostas); erro `23505` tratado como sucesso;
- após 5 tentativas: `moveToDeadLetter()` + `reportDeadLetter()`, nunca descarte silencioso;
- expõe `createTrainingVisit`, `setResponse`, `updateContact`, `completeTraining`, além de `isOnline`/`syncStatus`/`pendingCount`.

`processSyncQueue` (push) em `src/hooks/useOfflineSync.ts` passa a reconhecer explicitamente `training_visits` e `training_checklist_responses` nos casos de insert/update, sem cair no fallback genérico.

### 3. Componente

`src/components/treinamento/TrainingChecklistExecution.tsx` (novo, independente de `ChecklistExecution.tsx`), props `clienteId` e `responsavelUserId`:

- select de checklist (templates ativos, do cache quando offline);
- ao escolher o checklist, cria a `training_visits` local: status `pendente`, `cliente_id`, `checklist_template_id`, `created_by_user_id`, e o responsável gravado em `technician_user_id` quando o papel do usuário logado é técnico, ou em `csm_user_id` nos demais casos;
- itens renderizados por bloco, cada marcação gravando em `training_checklist_responses` pelo hook;
- "Concluir Treinamento" valida nome/telefone e marca a visita local como `concluida` com `completed_date` = hoje.

### 4. Integração nas telas

Seção colapsável "Combinar com Treinamento" renderizando o componente em:

- `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` (o resto da tela continua 100% online);
- `src/pages/preventivas/AtendimentoPreventivo.tsx`, ao lado da chamada existente de ChecklistExecution;
- `src/pages/instalacoes/ExecucaoEtapa.tsx`.

## Fora de escopo

Não alterar `ChecklistExecution.tsx`, `preventive_checklists`/`preventive_checklist_items`, `Treinamento.tsx` nem `NovaVisitaTreinamentoDialog.tsx`; não reintroduzir Dexie para o restante do fluxo de corretivas.

## Validação

Typecheck e build; teste no preview criando um treinamento combinado nas três telas, simulando perda de conexão e conferindo a sincronização e a exibição nas abas Treinamentos e Clientes.
