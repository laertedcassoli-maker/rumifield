# Nova Visita: escolher Corretiva ou Preventiva

Hoje o diálogo "Nova Visita" (em Visita Técnica) sempre cria uma visita corretiva. A ideia é permitir escolher o tipo: Corretiva (como hoje) ou Preventiva, que cria uma rota preventiva enxuta — só aquele produtor, aquele técnico, um dia.

## O que muda no diálogo

- Título passa a ser "Nova Visita" (hoje "Abrir Visita Técnica"), alinhado ao botão.
- Novo campo "Tipo de visita" logo abaixo do Cliente: dois botões Corretiva / Preventiva, no mesmo padrão de botão-destaque já usado no projeto. Começa em Corretiva, mantendo o comportamento atual.
- Campos por tipo:
  - Corretiva: Cliente, Técnico, Data planejada, Prioridade, Motivo (igual a hoje).
  - Preventiva: Cliente, Técnico, Data planejada, Checklist, Motivo. Sem Prioridade — preventiva não trabalha com prioridade.
- Obrigatórios: cliente, técnico, data e motivo sempre; prioridade só na corretiva; checklist só na preventiva.
- Botão de confirmar continua "Solicitar Visita" para os dois tipos.

## O que acontece ao salvar uma preventiva

É criada uma rota preventiva de um único dia e um único produtor, em elaboração, com o checklist escolhido e o motivo informado. Ela aparece na lista de Visita Técnica e também em Preventivas > Rotas, podendo ser executada normalmente. Em caso de falha no meio do processo, o que já foi criado é desfeito, para permitir nova tentativa limpa.

Mensagem de sucesso: "Visita preventiva solicitada com sucesso!" e o diálogo fecha, permanecendo na lista de Visita Técnica já atualizada.

## Detalhes técnicos

Arquivo único alterado: `src/components/chamados/NovaVisitaTecnicaDialog.tsx`.

- Novo estado `tipo: 'corretiva' | 'preventiva'` (default `'corretiva'`) e `checklistTemplateId`.
- Query de checklists: `checklist_templates` com `active = true`, `order('name')` — mesma de `NovaRota.tsx`, chave `['active-checklist-templates']`, `enabled: open && tipo === 'preventiva'`.
- Ramo preventivo da mutation:
  1. RPC `generate_preventive_route_code`.
  2. Insert em `preventive_routes`: `route_code`, `start_date` = `end_date` = data planejada em `yyyy-MM-dd`, `field_technician_user_id`, `checklist_template_id`, `notes` = motivo, `created_by_user_id` = usuário logado, `status: 'em_elaboracao'`.
  3. Insert em `preventive_route_items`: `route_id`, `client_id`, `order_index: 0`, `suggested_reason` = motivo, `status: 'planejado'`.
  4. Erro no item → delete da rota criada (mesmo padrão de limpeza de `NovaRota.tsx`).
  5. Sucesso → invalidar `['visita-tecnica']` e `['preventive-routes']`, toast, fechar; sem navegação.
- Ramo corretivo permanece byte-equivalente ao atual (chamado + `ticket_visits` + timeline + rollback).
- Reset do formulário ao fechar inclui `tipo` e `checklistTemplateId`.

Não serão alterados: `NovaRota.tsx`, `NovoChamado.tsx`, `NovaVisitaDialog.tsx`, nem a query de listagem de `VisitaTecnica.tsx`.
