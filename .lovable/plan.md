## Ajustes nas Ordens de Serviço

### 1. `src/components/oficina/OSKanban.tsx`
Remover apenas o bloco que exibe "Responsável: {os.profiles.nome}" (linhas ~156-160):

```tsx
{os.profiles?.nome && (
  <p className="text-xs text-muted-foreground mb-2">
    Responsável: {os.profiles.nome}
  </p>
)}
```

Nenhuma outra alteração no arquivo.

### 2. Migration SQL — backfill `concluded_by_user_id`
Popular OS concluídas com `concluded_by_user_id` NULL usando o último `work_order_time_entries` com status `finished`:

```sql
UPDATE public.work_orders wo
SET concluded_by_user_id = (
  SELECT te.user_id
  FROM public.work_order_time_entries te
  WHERE te.work_order_id = wo.id
    AND te.status = 'finished'
  ORDER BY te.ended_at DESC
  LIMIT 1
)
WHERE wo.status = 'concluido'
  AND wo.concluded_by_user_id IS NULL;
```

### Fora de escopo
Nenhuma outra alteração em arquivos TS, componentes ou migrations.
