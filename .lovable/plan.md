# Histórico de status dos pedidos + ajustes em Clientes RF

## Objetivo
Passar a registrar, a partir de agora, a data de cada mudança de status dos pedidos, para mostrar "Concluído em {data}" na lista de Clientes RF e uma linha do tempo completa no detalhe da solicitação.

## O que será feito

### 1. Registro automático no banco
- Nova tabela de histórico de status dos pedidos, guardando o pedido, o status, a data/hora e quem alterou.
- Um gatilho no banco grava uma linha automaticamente sempre que um pedido é criado ou muda de status — nenhuma tela de pedidos precisa ser alterada.
- Leitura liberada para usuários autenticados (mesma regra já usada em pedidos); gravação só pelo gatilho.
- Importante: só vale daqui para frente. Pedidos que já mudaram de status no passado não terão as datas antigas.

### 2. Lista de Clientes RF (detalhe do cliente)
- Quando a solicitação está "Entregue", a linha passa a mostrar "{Tipo} - Concluído em {data}", usando a data em que virou entregue.
- Nos outros casos, continua "{Tipo} · {data de criação}".
- O selo "Faturado" passa a ser verde (mesmo verde de "Resolvido" nos chamados); os demais seguem neutros.

### 3. Diálogo de detalhes da solicitação
- Nova seção "Linha do tempo" com todos os registros de status daquele pedido em ordem cronológica, com rótulo e data/hora, no mesmo estilo de timeline já usado no histórico do cliente.
- Continua 100% leitura, sem nenhum botão de ação, para qualquer perfil.

## Detalhes técnicos
- Migration: `pedido_status_history` (id, pedido_id → pedidos on delete cascade, status `pedido_status`, changed_at, changed_by → auth.users), índice `(pedido_id, changed_at)`, RLS ativo, GRANT SELECT para `authenticated` + GRANT ALL para `service_role`, policy SELECT `USING (true)`.
- Function `log_pedido_status_change()` SECURITY DEFINER + trigger `AFTER INSERT OR UPDATE OF status ON pedidos` com `WHEN (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)`, gravando `auth.uid()` em `changed_by`.
- Regenerar `types.ts` após a migration.
- `ClientesRFDetalhe.tsx`: query extra em `pedido_status_history` por `pedido_id in (...)` e `status = 'entregue'`, pegando o registro mais recente por pedido; mapa usado na linha inferior do item.
- `PedidoDetalheDialog.tsx`: query do histórico do pedido (`order by changed_at asc`) + seção de timeline; helper de cor do badge com verde para `faturado`.

## Fora de escopo
`Pedidos.tsx`, `ProcessarPedidoDialog.tsx`, `ConcluirPedidoDialog.tsx`, `ProcessarPendenciaDialog.tsx`, cores de badge em `Pedidos.tsx`, RLS existente de `pedidos`/`pedido_itens`, `ClienteHistoricoTab.tsx`.
