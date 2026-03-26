

## Limpar registros antigos de preventive_maintenance (sem rota)

### Situação

Restam **102 registros** na tabela `preventive_maintenance` com `route_id IS NULL` — são dados de teste antigos que aparecem no calendário. Distribuição: 96 planejadas, 5 concluídas, 1 cancelada.

### Operação

Executar DELETEs na ordem correta (respeitando cascatas):

1. **`DELETE FROM pedido_itens`** onde o pedido aponta para essas preventivas
2. **`DELETE FROM pedidos`** onde `preventive_id` está nessas preventivas
3. **`DELETE FROM preventive_maintenance WHERE route_id IS NULL`** — cascata automática remove checklists, blocos, itens, ações e não-conformidades associados

### Resultado

O calendário de preventivas ficará limpo, pronto para produção.

### O que NÃO será afetado
- Clientes, chamados, pedidos sem vínculo preventivo, CRM, estoque, templates de checklist

