

## Corrigir permissões RLS nas tabelas relacionadas à OS

### Problema
A política de UPDATE na `work_orders` foi corrigida para incluir `tecnico_oficina`, mas as tabelas **filhas** (`work_order_items`, `work_order_parts_used`) ainda verificam apenas `created_by_user_id`, `assigned_to_user_id` ou admin/coordenador na work_order pai. Bruno consegue atualizar o status da OS, mas falha ao tentar atualizar horímetro (`work_order_items`) ou adicionar peças (`work_order_parts_used`), pois essas políticas não incluem `tecnico_oficina`.

### Correção — Migration SQL

Atualizar as políticas de INSERT, UPDATE e DELETE em `work_order_items` e `work_order_parts_used` para incluir `tecnico_oficina`:

```sql
-- work_order_items: INSERT, UPDATE, DELETE
DROP POLICY "Users can insert work_order_items" ON work_order_items;
CREATE POLICY "Users can insert work_order_items" ON work_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_items.work_order_id
      AND (wo.created_by_user_id = auth.uid() OR wo.assigned_to_user_id = auth.uid()
           OR is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'tecnico_oficina')))
  );

-- Repetir para UPDATE, DELETE em work_order_items
-- Repetir para INSERT, UPDATE, DELETE em work_order_parts_used
```

Mesma lógica: adicionar `OR has_role(auth.uid(), 'tecnico_oficina')` em todas as policies de escrita dessas duas tabelas.

### Arquivos
- Apenas migration SQL (6 políticas atualizadas)

