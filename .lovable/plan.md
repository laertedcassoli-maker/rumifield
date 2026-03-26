

## Apagar todos os chamados e visitas corretivas

### Dados encontrados

| Tabela | Registros |
|---|---|
| technical_tickets | 62 |
| ticket_visits (CORR) | 41 |
| ticket_timeline | 204 |
| ticket_tag_links | 13 |
| ticket_visit_actions | 0 |
| ticket_parts_requests | 0 |
| pedidos (origem corretiva) | 0 |

### Sequência de DELETEs (respeitando FKs)

1. `DELETE FROM ticket_visit_actions` — ações das visitas
2. `DELETE FROM ticket_parts_requests` — peças vinculadas a chamados
3. `DELETE FROM ticket_tag_links` — etiquetas dos chamados
4. `DELETE FROM ticket_timeline` — linha do tempo
5. `DELETE FROM ticket_visits` — visitas corretivas (CORR)
6. `DELETE FROM technical_tickets` — chamados

### O que NÃO será afetado
- Clientes, rotas preventivas, pedidos, CRM, estoque
- Tags e categorias de chamados (apenas os vínculos são removidos)

### Método
Usar o insert tool para executar os DELETEs sequencialmente.

