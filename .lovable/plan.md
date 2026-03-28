

## Limpar dados de teste — preventivas e corretivas

### Dados encontrados

| Tabela | Registros |
|---|---|
| preventive_routes | 2 |
| preventive_route_items | 2 (CASCADE automático) |
| preventive_maintenance | 9 |
| preventive_checklists | 4 (CASCADE automático) |
| technical_tickets | 9 |
| ticket_visits | 9 |
| ticket_timeline | 22 |
| pedidos / pedido_itens | 0 |
| visita_midias | 0 |

### Sequência de DELETEs

1. `DELETE FROM ticket_timeline` — 22 registros
2. `DELETE FROM ticket_visits` — 9 visitas corretivas
3. `DELETE FROM technical_tickets` — 9 chamados
4. `DELETE FROM preventive_maintenance` — 9 registros (cascata remove checklists, blocos, itens, ações)
5. `DELETE FROM preventive_route_items` — 2 itens
6. `DELETE FROM preventive_routes` — 2 rotas

### O que NÃO será afetado
- Clientes, pedidos, CRM, estoque, oficina, templates de checklist, usuários

### Método
Usar o insert tool para executar os DELETEs sequencialmente.

