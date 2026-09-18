# Treinamento: conclusão com checklist obrigatório + Editar/Excluir visitas

## Parte 1 — Conclusão com checklist obrigatório (plano já aprovado)

- `TrainingChecklistExecution.tsx`: nova prop `existingVisitId`. Quando informada, não cria visita nova: carrega a existente (online busca no servidor e guarda cópia local; offline lê o cache), pré-preenche checklist/nome/telefone e as respostas já salvas. Se a visita não tiver checklist, o seletor grava a escolha na própria visita.
- Botão "Concluir Treinamento" no modo avulso só libera com nome + telefone + **todos os itens marcados** (clique mostra aviso do que falta). Fluxo combinado (corretiva/preventiva/instalação) permanece igual.
- Hook `useOfflineTrainingChecklist`: novo `getTrainingVisit(id)` com cache local.
- `Treinamento.tsx`: botão "Concluir" abre Dialog com o checklist; removida a conclusão direta (`concluirMutation`).

## Parte 2 — Editar e Excluir visitas (novo)

### NovaVisitaTreinamentoDialog.tsx
- Nova prop opcional `editingVisit` (linha de `training_visits`).
- Quando informada: título "Editar Visita de Treinamento", campos pré-preenchidos (cliente, responsável derivado de `technician_user_id ?? csm_user_id`, checklist, data planejada, nome/telefone, motivo) e salvamento via `.update().eq('id', ...)` em vez de `.insert()`.
- Sem `editingVisit`, a criação continua exatamente igual.

### Treinamento.tsx — coluna Ações
- Botões "Editar" (Pencil) e "Excluir" (Trash2) ao lado do "Concluir", visíveis **somente** quando `canAbrirVisita` (admin, coordenador de serviços, coordenador R+) **e** `v.status === 'pendente'`.
- "Editar" abre `NovaVisitaTreinamentoDialog` com `editingVisit={v}`.
- "Excluir" abre AlertDialog de confirmação; ao confirmar, apaga a visita (as respostas de checklist são removidas em cascata). Lista atualizada em seguida.
- Técnicos nunca veem esses botões; visitas concluídas ficam travadas para todos (histórico preservado).

## O que NÃO será alterado

- Fluxo combinado: `CombinarTreinamentoSection.tsx` e as 3 telas de execução (corretiva, preventiva, instalação).
- Criação avulsa sem `editingVisit` continua permitindo campos em branco.
- Nenhuma mudança de schema/RLS (exclusão usa as permissões já existentes para usuários autenticados).

## Critérios de aceite

- Concluir visita avulsa exige checklist completo + nome + telefone.
- Admin/coordenador edita e exclui visitas pendentes; técnico não vê Editar/Excluir; visitas concluídas não mostram essas ações.

## Validação

- `bunx tsgo --noEmit` e build limpos.
- Preview: concluir visita com checklist; editar visita pendente; excluir visita com confirmação; conferir ausência dos botões para técnico e para visitas concluídas. Registros de teste removidos ao final.
