# Cancelar ou excluir visitas de Treinamento de Manutenção

## O que conferi no banco
- `training_visits` tem 4 regras abertas a qualquer usuário logado: "Authenticated can read / create / update / delete training visits", todas com `true`. Não há restrição de status no banco.
- As tabelas filhas (respostas do checklist e participantes) também estão abertas a qualquer usuário logado, para leitura e escrita (ALL `true`). **Essas ficam como estão**, para você avaliar depois.
- Na tela de Permissões, o menu `treinamento` está com "Excluir" desmarcado para todos os papéis (admin, coord. serviços, coord. R+, técnico de campo, técnico de oficina). Hoje quem decide é uma regra fixa no código (admin e coord. serviços).

## Regras
- **Exclusão real:** só para visita pendente que ainda não tem nenhuma resposta de checklist.
- **Cancelamento:** visita concluída, ou pendente com respostas, só pode ser cancelada, com motivo obrigatório. Ela continua no histórico e as respostas são mantidas.
- **Quem pode:** quem tem "Cancelar/Excluir" marcado no menu Treinamento, na tela de Permissões. Vou marcar para admin e coordenador de serviços, como é hoje. O banco recusa os demais.

## Banco (migração)
1. Criar a função `can_cancel_treinamento(uuid)`, no mesmo padrão de `can_cancel_corretiva`: admin, ou algum papel do usuário com `can_delete` em `treinamento`. Ela é restrita a usuários logados (sem acesso anônimo).
2. Marcar `can_delete = true` em `treinamento` só para admin e coordenador_servicos.
3. Trocar a regra de exclusão: só quando `can_cancel_treinamento`, status = 'pendente' e não houver respostas de checklist.
4. Trocar a regra de edição: mesmo acesso de hoje, mas o status 'cancelada' só pode ser gravado por quem tem `can_cancel_treinamento`.

## Telas
- **Novo arquivo `src/lib/training-cancel.ts`**, com:
  - `cancelTrainingVisit`: grava a nota "[Cancelada em dd/mm/aaaa hh:mm] motivo" ao final das observações, confere se o registro voltou do banco e espera no máximo 12s.
  - `hardDeleteTrainingVisit`: faz a exclusão real.
- **`Treinamento.tsx`:**
  - O botão passa a seguir `canDelete('treinamento')`.
  - Visita pendente sem respostas: lixeira e o diálogo de exclusão atual.
  - Demais casos: ícone de proibido, "Cancelar visita", e o diálogo com motivo obrigatório.
  - O filtro de status ganha a opção "Canceladas", com o selo "Cancelada". Canceladas continuam ocultas por padrão e fora das contagens.
  - Depois de cancelar ou excluir, atualiza a lista de treinamentos e Minhas Pendências.
- **Execução do checklist** (tela e sincronização sem sinal): a visita cancelada não abre para execução, e respostas pendentes dessa visita não sobem.
- **Permissões:** a coluna "Excluir" do menu Treinamento passa a se chamar "Cancelar/Excluir".

## Não muda
Criação de visita, participantes, Minhas Pendências (já mostra só pendentes), as regras de acesso das tabelas filhas e as demais telas.

## Teste
- Checagem de código.
- Conferir as novas regras no banco.
- Na prévia, como admin: ver a lixeira numa visita pendente sem respostas e "Cancelar" numa concluída.
- Sem cancelar dados reais, a não ser que você indique uma visita de teste.

Nada será publicado.
