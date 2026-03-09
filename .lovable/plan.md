

## Limpeza de Dados de Teste

Dados encontrados para exclusão:

| Tabela | Registros |
|--------|-----------|
| workshop_items | 21 |
| work_orders | 20 |
| work_order_items | 18 |
| work_order_parts_used | 20 |
| work_order_time_entries | 37 |
| motor_replacement_history | 7 |
| asset_meter_readings | 19 |
| warranty_batches | 2 |
| warranty_requests | 3 |

## Plano

Executar DELETEs na ordem correta (tabelas dependentes primeiro) usando a ferramenta de inserção de dados:

1. `warranty_requests` (referencia warranty_batches, motor_replacement_history, work_orders, workshop_items)
2. `motor_replacement_history` (referencia workshop_items, work_orders, warranty_batches)
3. `warranty_batches`
4. `work_order_time_entries` (referencia work_orders)
5. `work_order_parts_used` (referencia work_orders)
6. `work_order_items` (referencia work_orders, workshop_items)
7. `asset_meter_readings` (referencia workshop_items)
8. `work_orders`
9. `workshop_items`

Todos os registros serão removidos permanentemente. Nenhuma alteração de código necessária.

