

## Substituir referências do usuário Lenilton antigo pelo novo

### Contexto
O usuário antigo **lenilton@rumina.com.br** (`16073f9d...`) foi deletado e substituído por **lenilton.dantas@rumina.com.br** (`1cb8602e...`). Existem 91 registros em 4 tabelas que ainda referenciam o ID antigo.

### Migração SQL

Uma única migração que atualiza todas as referências:

1. **preventive_maintenance** (63 registros) -- atualizar `technician_user_id`
2. **technical_tickets** (10 registros) -- atualizar `assigned_technician_id`
3. **preventive_routes** (10 registros) -- atualizar `field_technician_user_id`
4. **ticket_visits** (8 registros) -- atualizar `field_technician_user_id`

Cada UPDATE filtra pelo ID antigo e substitui pelo novo. Nenhuma alteração de código é necessária.

### Detalhes técnicos

```sql
-- Substituir Lenilton antigo pelo novo em todas as tabelas
UPDATE preventive_maintenance SET technician_user_id = '1cb8602e-423a-4a09-ae04-98e0142d5316' WHERE technician_user_id = '16073f9d-eb55-44a7-8aab-ca1d362699c9';
UPDATE technical_tickets SET assigned_technician_id = '1cb8602e-423a-4a09-ae04-98e0142d5316' WHERE assigned_technician_id = '16073f9d-eb55-44a7-8aab-ca1d362699c9';
UPDATE preventive_routes SET field_technician_user_id = '1cb8602e-423a-4a09-ae04-98e0142d5316' WHERE field_technician_user_id = '16073f9d-eb55-44a7-8aab-ca1d362699c9';
UPDATE ticket_visits SET field_technician_user_id = '1cb8602e-423a-4a09-ae04-98e0142d5316' WHERE field_technician_user_id = '16073f9d-eb55-44a7-8aab-ca1d362699c9';
```
