

## Excluir pedido SP-00000109 da base

### Pedido encontrado

| Campo | Valor |
|---|---|
| Código | SP-00000109 |
| ID | `10d5db1b-5da6-4a2a-b95c-9a9b3f5bc849` |
| Cliente | Celso Ricardo Trevizan |
| Status | **processamento** |
| Itens | 1 |
| Criado em | 23/04/2026 16:06 UTC |

### O que será apagado (em cascata, na ordem)

1. `pedido_item_assets` — vínculos de ativos dos itens do pedido.
2. `pedido_itens` — o(s) item(ns) do pedido.
3. `pedido_item_log` — histórico de alterações dos itens (auditoria).
4. `pedidos` — o registro principal do pedido.

Tudo dentro de uma única migration transacional, filtrada exclusivamente pelo `id` `10d5db1b-5da6-4a2a-b95c-9a9b3f5bc849` (sem risco de afetar outros pedidos).

### O que NÃO será alterado

- Outros pedidos, clientes, peças, ativos da oficina ou qualquer integração com Omie.
- Estrutura do banco (sem `ALTER TABLE`, sem mudança de RLS).
- Código React.

### Observação importante

O pedido está em **processamento** — ou seja, já saiu do rascunho e foi transmitido. Excluir um pedido nesse estágio é uma **operação destrutiva e irreversível** e remove o rastro de auditoria. Se a intenção for apenas "cancelar" ou "marcar como inválido" preservando histórico, recomendo um caminho alternativo (mudar status para `cancelado` em vez de excluir). Confirma que mesmo assim deseja **excluir definitivamente**?

