# Fase 2 — Preventiva: cancelar em vez de excluir

## O que muda
- **Visita da rota (em Visita Técnica, Atendimento e Detalhe da Rota):** se ainda está planejada ou reagendada, o botão continua excluindo de verdade. Se já foi executada, o botão vira "Cancelar", pede justificativa obrigatória e marca a visita como cancelada (e a preventiva dela como cancelada).
- **Rota inteira (Detalhe da Rota e Execução da Rota):** em elaboração, continua excluindo. Nos outros status, vira "Cancelar rota" com justificativa obrigatória: a rota fica cancelada e as visitas ainda planejadas/reagendadas também são canceladas. Visitas já executadas não são tocadas.
- Visitas já canceladas ficam sem botão de excluir/cancelar (hoje a exclusão delas falharia).
- O cancelamento de visita que já existe na Execução da Rota continua igual.

Atenção: cancelar uma visita já executada marca a preventiva dela como "cancelada", então ela deixa de contar como concluída nos relatórios e no status da fazenda. É o que o pedido descreve; confirme se é isso mesmo.

## Detalhes técnicos
- Nova função compartilhada `cancelPreventiveRouteItem({ itemId, routeId, clientId, justification, routeStartDate, technicianId })` em `src/lib/preventive-cancel.ts`, com a mesma lógica online do `cancelMutation` de ExecucaoRota: item `status='cancelado'`; `preventive_maintenance` por (route_id, client_id) → `cancelada` + `notes=justificativa` (cria se não existir); retornos checados com `.select('id')`, timeout 15s. Não altera o `cancelMutation`/`cancelOffline` de ExecucaoRota (continua offline-first como hoje).
- **VisitaTecnica.tsx / AtendimentoPreventivo.tsx:** o botão de lixeira decide pelo status do item (`planejado`/`reagendado` → exclusão atual; `executado` → diálogo com justificativa + função compartilhada; `cancelado` → botão escondido). Em Visita Técnica o status do item já vem na lista (`r.status`).
- **DetalheRota.tsx (`removeRouteItem`):** o mesmo desvio; o cancelamento usa a função compartilhada (com justificativa), não o `updateItemStatus` sem justificativa. `updateItemStatus` fica como está para quem troca status pelo seletor.
- **Cancelar rota:** nova `cancelPreventiveRoute({ routeId, justification, ... })` na mesma lib: busca itens `planejado`/`reagendado`, aplica o cancelamento de item a cada um, depois `preventive_routes.status='cancelada'` (justificativa guardada nas notas da preventiva de cada item; a rota não tem campo de observação). Diálogos de ExecucaoRota (~linha 831) e DetalheRota (~linha 669) passam a mostrar "Excluir rota" ou "Cancelar rota" conforme `route.status`.
- Rótulo/cor "Cancelada" para rota em Rotas.tsx, ExecucaoRota e DetalheRota onde houver mapa de status.
- **Contagens:** `preventivasGerencial.ts` linha 288 conta rota não finalizada vencida como "em atraso" — passa a ignorar `cancelada`. Minhas Pendências e Agenda já usam listas de status em aberto / já excluem cancelados (sem mudança). Calendário: conferir o filtro e excluir `cancelada` se hoje contar como pendente.
- Sem mudanças de banco. Nada publicado.

## Validação
- Checagem de tipos.
- Conferir por consulta, após testes na prévia: item planejado excluído some; item executado fica `cancelado` com preventiva `cancelada`; rota cancelada mantém executados.
