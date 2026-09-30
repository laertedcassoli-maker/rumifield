# Fase 2 — Cancelamento na Instalação + limpeza + fotos no relatório

## O que muda para o usuário
- **Etapa ainda "Planejada"**: "Excluir" continua excluindo de verdade.
- **Etapa já iniciada**: vira "Cancelar esta etapa?" com justificativa obrigatória; fica "Cancelada".
- **Instalação com todas as etapas planejadas**: exclusão definitiva como hoje.
- **Instalação com alguma etapa iniciada**: vira "Cancelar esta instalação?" com justificativa obrigatória; a instalação e as etapas ainda planejadas ficam "Cancelada"; etapas em andamento/concluídas não mudam.
- Botões somem quando já cancelado. Novo selo "Cancelada" na lista (instalação e etapa).
- Cancelados não contam como "em andamento" nos resumos/filtros nem aparecem na Agenda.
- Pré Instalação: fica só o botão "Encerrar Visita" no rodapé (o "Concluir" do topo, que abria a mesma confirmação, sai).
- Relatório público de Instalação mostra as fotos de cada item junto ao item.

## Detalhes técnicos
1. **Migração** (`installations`):
   - `ADD COLUMN arquivado boolean NOT NULL DEFAULT false`.
   - Trocar a regra ALL "Managers can manage installations" por SELECT/INSERT/UPDATE com `can_manage_installations()` (idênticas) + DELETE com `can_manage_installations() AND NOT EXISTS (etapa com status <> 'planejado')`. As regras "Authenticated users can read installations" e "Public reads installation by report" não mudam; `installation_stages` também não.
2. **`src/pages/instalacoes/Index.tsx`** (alteração pedida explicitamente em `deleteInstallationMutation`/`deleteStageMutation`):
   - Novo `src/lib/installation-cancel.ts`: `cancelStage(id, motivo)` e `cancelInstallation(id, motivo)` (update com `.select('id')`, timeout 12s; cascata só em etapas `planejado`). O motivo vai para as observações internas da etapa (coluna de observação existente, conferida na implementação) com data/hora.
   - Diálogos condicionais: exclusão atual quando permitido; senão, reaproveitar `CancelReasonDialog` (motivo obrigatório, toast se vazio).
   - `classificarSituacao` ganha `'cancelada'`; badges de instalação/etapa ganham "Cancelada"; filtro "em andamento" e resumo ignoram `cancelado`.
3. **`src/hooks/useAgendaOperacoes.ts`**: query de `installation_stages` com `.neq('status','cancelado')`, filtrando também instalações canceladas.
4. **`src/components/instalacoes/ChecklistExecution.tsx`**: remover o botão "Concluir" do cabeçalho (~l.1104-1114); o "Encerrar Visita" do rodapé permanece (mesmo `handleCompleteClick`).
5. **`src/pages/instalacoes/RelatorioInstalacao.tsx`**: buscar `installation_checklist_item_photos` pelos `itemIds`, gerar URLs assinadas no mesmo bucket das fotos de item, exibir miniaturas (com ampliação) sob cada item.
6. Sem publicar. Typecheck ao final.
