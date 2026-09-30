# Fase 1: bloquear exclusão definitiva quando já há trabalho registrado (só banco)

## O que muda
- Só dá para excluir de verdade uma atividade que ainda não teve trabalho: OS aguardando, pedido em rascunho, rota em elaboração, item de rota planejado/reagendado, chamado aberto, visita corretiva em elaboração/planejada, etapa de instalação planejada.
- Os status de cancelamento passam a existir onde faltavam, e as atividades ganham a marcação "arquivado" (sem uso nas telas ainda).
- Nenhuma tela muda. Atenção: botões "Excluir" que hoje funcionam em qualquer status (ex. excluir pedido em qualquer status pelo coordenador/admin, excluir preventiva pela Visita Técnica) vão passar a falhar com erro nesses casos até a Fase 2 trocar por "Cancelar".

## Regras de exclusão reais hoje (lidas do banco)
| Tabela | Regras que cobrem exclusão hoje | Ação |
|---|---|---|
| work_orders | "Admins can delete work_orders" (DELETE) | recriar com `AND status='aguardando'` |
| work_order_items | "Users can delete work_order_items" (DELETE) | recriar: condição atual `AND` OS pai `aguardando` `AND is_admin_or_coordinator` |
| work_order_parts_used | "Users can delete parts_used" + "Users can delete work_order_parts_used" (DELETE) | recriar ambas com OS pai `aguardando` `AND is_admin_or_coordinator` |
| pedidos | "Admins and coords can delete any pedido", "Users can delete their own pedidos" (DELETE) | recriar ambas com `AND status='rascunho'` |
| pedido_itens | "Admins and coords can delete any pedido_itens", "Users can delete pedido_itens of their pedidos" | recriar com pedido pai `rascunho` |
| pedido_item_assets | "Admins and coords can delete any…", "Owner can delete…" (DELETE) + "Admins can manage pedido_item_assets" (ALL) | recriar as 2 DELETE com pedido pai `rascunho`; dividir o ALL em SELECT/INSERT/UPDATE idênticos + DELETE com pedido pai `rascunho` |
| pedido_item_log | "Owner and managers can delete pedido_item_log" | recriar com pedido pai `rascunho` |
| preventive_route_items | "Admins and coordinators can delete preventive_route_items" | `AND status IN ('planejado','reagendado')` |
| preventive_routes | "Admins and coordinators can delete preventive_routes" | `AND status='em_elaboracao'` |
| technical_tickets | "Admins and coordinators can manage technical_tickets" (ALL, papel public) | dividir em SELECT/INSERT/UPDATE idênticos + DELETE `AND status='aberto'` |
| ticket_visits | "Admins and coordinators can manage ticket_visits" (ALL, papel public) | dividir + DELETE `AND status IN ('em_elaboracao','planejada')` |
| installation_stages | "Managers can manage installation_stages" (ALL) | dividir + DELETE `AND status='planejado'` |

Políticas de UPDATE de pedidos (`can_manage_pedidos`) e todas as de SELECT/INSERT/UPDATE separadas ficam intocadas. corrective_maintenance continua sem regra de exclusão.

Observação: a exclusão de itens de pedido/ativos em rascunho (editar rascunho) continua funcionando; já trocar ativos de um pedido depois de "Processar" deixa de poder apagar a linha antiga do ativo. Se o app faz isso hoje (editar ativos no detalhe do pedido), essa edição passa a falhar — vou conferir no código antes de aplicar e, se for o caso, manter o DELETE de pedido_item_assets sem a trava e avisar.

## Detalhes técnicos
- Migração 1 (enums, precisa ir separada porque `ADD VALUE` não pode ser usado na mesma transação): `work_order_status` + 'cancelada', `pedido_status` + 'cancelado', `preventive_route_status` + 'cancelada'.
- Migração 2:
  - CHECK de `corrective_maintenance.status`: recriado com 'pendente','em_andamento','concluida','cancelada'.
  - Novo CHECK em `installations.status` e `installation_stages.status`: 'planejado','em_andamento','aguardando_aprovacao','concluido','cancelado' (dados atuais só têm 'em_andamento'; confirmo antes que não há outro valor em uso).
  - `arquivado boolean NOT NULL DEFAULT false` nas 8 tabelas.
  - Recriação das regras de exclusão conforme a tabela acima; ao dividir uma regra ALL, as novas mantêm o mesmo papel e a mesma condição.
- Tipos regenerados automaticamente.

## Validação
- Consultar pg_policies depois e comparar as condições de SELECT/INSERT/UPDATE com as de antes (sem diferença).
- Testes em transação com ROLLBACK, simulando admin e dono: excluir em status permitido funciona, em status bloqueado não remove nada; editar pedido em rascunho como dono e processar como coordenador continuam funcionando.
- Nada é publicado.
