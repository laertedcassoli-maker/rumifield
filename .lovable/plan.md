

## Limpar todas as 23 rotas preventivas para início da produção

### Cadeia de dependências identificada

```text
preventive_routes
  ├── preventive_route_items (ON DELETE CASCADE — automático)
  └── preventive_maintenance.route_id (ON DELETE SET NULL)
        └── preventive_checklists (ON DELETE CASCADE)
              └── preventive_checklist_blocks (CASCADE)
                    └── preventive_checklist_items (CASCADE)
                          ├── preventive_checklist_item_actions (CASCADE)
                          └── preventive_checklist_item_nonconformities (CASCADE)

pedidos.preventive_id → referencia preventive_maintenance (pode existir)
```

### Sequência de DELETEs necessária

Precisamos executar na ordem correta para não deixar dados órfãos:

1. **`DELETE FROM pedido_itens`** onde o pedido está vinculado a uma preventiva das rotas
2. **`DELETE FROM pedidos`** onde `preventive_id` aponta para uma `preventive_maintenance` vinculada às rotas
3. **`DELETE FROM preventive_maintenance`** onde `route_id IS NOT NULL` — isso dispara CASCADE automático para checklists, blocos, itens, ações e não-conformidades
4. **`DELETE FROM preventive_routes`** — isso dispara CASCADE automático para `preventive_route_items`

### O que será removido

- 23 rotas preventivas e seus itens (fazendas)
- Todas as preventivas vinculadas a essas rotas + seus checklists completos
- Pedidos de peças originados dessas preventivas (se houver)

### O que NÃO será afetado

- Clientes
- Chamados e visitas corretivas
- Pedidos não vinculados a preventivas
- Templates de checklist
- Dados de CRM

### Método

Usar o migration tool para executar os DELETEs sequencialmente, com confirmação prévia.

