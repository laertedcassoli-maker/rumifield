# Treinamento de Manutenção — múltiplos treinados, técnico de campo e exclusão restrita

## O que muda para quem usa

1. **Quem executa o treinamento**: no pedido de nova visita, a lista de "Técnico" passa a mostrar apenas técnicos de campo. O seletor de CSM continua igual.
2. **Várias pessoas treinadas**: tanto ao solicitar a visita quanto ao concluir o treinamento, aparece um botão "+" para adicionar quantas pessoas quiser (nome obrigatório, telefone opcional em cada). A primeira pessoa continua sendo gravada nos campos atuais de nome/telefone; as demais entram na nova lista.
3. **Novo nome**: onde hoje aparece "Treinamento"/"Treinamentos", passa a aparecer **Treinamento de Manutenção** (menu, tela inicial, Minhas Pendências, tela de treinamentos, diálogos, seção dentro das visitas). A tela de treinamentos ganha o subtítulo "Treinamento de Capacitação Técnica para as Fazendas".
4. **Excluir visita**: só Admin e Coordenador de Serviços passam a ver o botão de excluir. Abrir e editar continua como está hoje (inclui Coordenador R+).

## Banco de dados

Nova tabela `training_visit_attendees`:

- `id`, `training_visit_id` (referência a `training_visits`, exclusão em cascata), `nome` (obrigatório), `telefone` (opcional), `created_at`.
- GRANT para `authenticated` e `service_role`; RLS ativa com as mesmas duas políticas abertas para autenticados usadas em `training_checklist_responses` (leitura e escrita).

## Alterações no código

- **NovaVisitaTreinamentoDialog.tsx**: query `training-responsaveis` passa a buscar `tecnico_campo` para o tipo técnico (mantendo `consultor_rplus`/`coordenador_rplus` como CSM); remoção de `tecnico_oficina` da lista. Bloco "Nome de quem receberá o treinamento" vira lista dinâmica (estado `attendees: {nome, telefone}[]`) com botão "+" e remover por linha; no submit, a primeira linha alimenta `contact_name`/`contact_phone` (comportamento atual preservado) e todas as linhas com nome são inseridas em `training_visit_attendees` após criar/editar a visita (na edição, substitui a lista anterior da visita). Título do diálogo renomeado.
- **TrainingChecklistExecution.tsx**: mesmo bloco de lista com "+" em "Dados de quem recebeu o treinamento"; primeira linha mantém a validação atual de nome+telefone obrigatórios na conclusão; demais linhas exigem apenas nome. No modo "visita existente", a lista já salva é carregada. Textos do card, toasts e botão renomeados.
- **Offline**: os participantes seguem o mesmo padrão já existente — nova tabela `trainingAttendees` no Dexie (`src/lib/offline-checklist-db.ts`) com upgrade de versão e entrada `training_visit_attendees` na fila de sincronização, reaproveitando o fluxo de `training_checklist_responses` em `useOfflineTrainingChecklist.ts`. Assim adicionar pessoas funciona sem sinal.
- **Treinamento.tsx**: nova checagem `podeExcluir = role === 'admin' || role === 'coordenador_servicos'` usada apenas no botão/diálogo de exclusão; `podeGerenciar` (editar) continua com `canAbrirVisita`. Título, subtítulo novo, botão, aba e título do diálogo de conclusão renomeados. A lista de participantes aparece no detalhe/histórico junto de `contact_name`.
- **Renomeações de texto**: `AppSidebar.tsx`, `Home.tsx`, `MinhasPendencias.tsx` (título da seção, texto vazio e rótulo do item), `CombinarTreinamentoSection.tsx` (label "Combinar com Treinamento de Manutenção").

## Fora do escopo

- `csm_user_id` e o seletor de CSM permanecem intactos.
- `contact_name`/`contact_phone` continuam existindo e sendo usados.
- Regras de quem pode abrir/editar visitas de treinamento não mudam.
- Rotas, `permKey: 'treinamento'` e nomes de tabelas permanecem os mesmos.
