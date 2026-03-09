

## Permitir que qualquer usuário com acesso ao módulo de OS possa editar

### Problema
A política RLS de UPDATE em `work_orders` permite apenas `assigned_to_user_id` ou admin/coordenador. Técnicos de oficina (`tecnico_oficina`) não conseguem atualizar OS que não estejam atribuídas a eles — causando falhas silenciosas (como o caso da OS-2026-00014).

### Solução
Atualizar a política RLS de UPDATE para incluir `created_by_user_id` e o role `tecnico_oficina`:

```sql
DROP POLICY "Users can update assigned work_orders" ON work_orders;
CREATE POLICY "Users can update assigned work_orders" ON work_orders
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = assigned_to_user_id 
    OR auth.uid() = created_by_user_id
    OR is_admin_or_coordinator(auth.uid())
    OR public.has_role(auth.uid(), 'tecnico_oficina')
  );
```

### Correção de dados — OS-2026-00014
Atualizar status para `em_manutencao` e `total_time_seconds` para 1398 (sessão finalizada do Bruno).

### Arquivos
- Migration SQL (RLS policy)
- Insert tool (correção de dados)

