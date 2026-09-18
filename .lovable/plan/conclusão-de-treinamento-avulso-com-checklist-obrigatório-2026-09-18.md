# Conclusão de treinamento avulso com checklist obrigatório

## Objetivo

Hoje, na tela Treinamento, o botão "Concluir" de uma visita pendente marca a visita como concluída em um clique, sem checklist e sem nome/telefone do treinado. A conclusão passa a abrir o checklist completo em um diálogo, exigindo nome, telefone e todos os itens marcados antes de liberar a conclusão.

## O que muda

### 1. TrainingChecklistExecution.tsx — novo modo "visita existente"

Nova prop opcional `existingVisitId`. Quando informada:

- **Não cria** uma nova visita de treinamento. Carrega a visita existente do banco (e guarda uma cópia local no aparelho para funcionar sem sinal) ou lê a cópia local quando já estiver offline.
- Se a visita **já tiver checklist definido**, abre direto os itens desse checklist (seletor já preenchido). Se **não tiver**, mostra o seletor normalmente e, ao escolher, grava o checklist na própria visita (via `updateTrainingVisit`, já existente no hook).
- **Pré-preenche nome e telefone** com o que já estiver salvo na visita (campos continuam editáveis).
- **Carrega as respostas já salvas** e marca os itens correspondentes.

### 2. Regra de liberação do botão "Concluir Treinamento"

- **Modo visita existente (novo):** botão só habilita quando nome preenchido + telefone preenchido + **todos os itens do checklist marcados**. Mensagens de orientação indicam o que falta.
- **Modo combinado (corretiva/preventiva/instalação):** permanece como está — exige nome/telefone, sem exigir todos os itens. Nenhuma mudança nesse fluxo.
- Mantido o comportamento de validação com toast ao clicar (botão nunca fica mudo), conforme padrão do projeto: o botão continua clicável e informa o que falta, em vez de desabilitar silenciosamente.

### 3. Treinamento.tsx — conclusão via diálogo

- O botão "Concluir" da tabela passa a abrir um **Dialog** com `<TrainingChecklistExecution existingVisitId={v.id} clienteId={v.cliente_id} responsavelUserId={v.technician_user_id ?? v.csm_user_id} responsavelTipo={v.technician_user_id ? 'tecnico' : 'csm'} />`.
- Remover `concluirMutation` (deixa de existir conclusão direta).
- Ao concluir dentro do diálogo, a lista já é atualizada (o componente já invalida `['training-visits']`); adicionar callback `onCompleted` para fechar o diálogo automaticamente.
- Quem pode concluir continua o mesmo: admin/coordenadores e o responsável pela visita.

### 4. Camada offline (hook + banco local)

- Acrescentar no hook `getTrainingVisit(id)`: online, busca a visita no servidor e grava no cache local; offline, lê do cache. Necessário para o modo existente.
- Nenhuma migration nova — as tabelas `training_visits` e `training_checklist_responses` já existem com RLS aberta para usuários autenticados.

## O que NÃO será alterado

- `NovaVisitaTreinamentoDialog.tsx` — a criação continua permitindo checklist/nome/telefone em branco; só a conclusão passa a exigir.
- `CombinarTreinamentoSection.tsx` e as 3 telas de execução (corretiva, preventiva, instalação) — fluxo combinado inalterado.
- Nenhuma mudança em schema/RLS.

## Critérios de aceite

- Clicar em "Concluir" numa visita pendente abre o checklist (ou o seletor, se a visita não tiver checklist definido), com itens marcáveis e nome/telefone pré-preenchidos quando já salvos.
- A visita só fica "Concluída" depois de nome + telefone + todos os itens marcados.
- Funciona offline: marcações ficam no aparelho e sincronizam quando a conexão volta.

## Validação

- `bunx tsgo --noEmit` e build limpos.
- Teste no preview: criar visita avulsa sem checklist, abrir conclusão, escolher checklist, marcar itens, preencher nome/telefone, concluir; conferir que aparece como "Concluída" na lista e no histórico do cliente.
