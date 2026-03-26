

## Limpar todos os registros de solicitação de peças

### Operação

Executar 3 DELETEs na ordem correta (respeitando chaves estrangeiras):

1. `DELETE FROM ticket_parts_requests` — vínculos entre pedidos e chamados
2. `DELETE FROM pedido_itens` — itens dos pedidos
3. `DELETE FROM pedidos` — pedidos em si

### Método

Usar o insert tool (operação de dados, não de schema) para executar os DELETEs sequencialmente.

### Impacto

- Todos os pedidos, itens e vínculos com chamados serão removidos permanentemente
- Nenhum código será alterado
- O histórico de timeline dos chamados (`ticket_timeline`) permanece intacto (referências textuais, sem FK)

