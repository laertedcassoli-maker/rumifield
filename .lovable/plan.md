

## Problema

Todos os 14 ativos no banco estão com `status = 'em_manutencao'`. Quando limpamos os registros de work_orders, não resetamos o status dos workshop_items. A query de busca na criação de OS filtra `.eq('status', 'disponivel')`, por isso nenhum ativo aparece.

## Correção

Executar um UPDATE direto no banco para resetar todos os workshop_items para `status = 'disponivel'`, já que não existem mais OSs ativas no sistema.

```sql
UPDATE workshop_items SET status = 'disponivel' WHERE status = 'em_manutencao';
```

Nenhuma alteração de código necessária.

