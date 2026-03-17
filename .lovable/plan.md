

## Correção: Estado da OS não atualiza após ações (iniciar, parar, etc.)

### Causa raiz

O `DetalheOSDialog` recebe `workOrder={selectedOS}` como prop, mas `selectedOS` é um **snapshot estático** guardado no estado do componente pai (`OrdensServico`). Quando o usuário clica "Iniciar" e a mutation faz `invalidateQueries(['work-orders'])`, a lista `workOrders` é re-fetched, porém **`selectedOS` nunca é atualizado** — ele mantém o objeto antigo com `status: 'aguardando'` e `total_time_seconds: 0`.

Isso causa:
- O cronômetro não inicia (o `useEffect` do timer vê `workOrder.total_time_seconds` = 0 do snapshot antigo)
- O status exibido no dialog não muda
- O Kanban/lista atualiza corretamente porque usa `workOrders` do query, mas o dialog fica "congelado"

### Correção

**Arquivo: `src/pages/oficina/OrdensServico.tsx`**

1. Adicionar um `useEffect` que sincroniza `selectedOS` com os dados mais recentes da query `workOrders`:

```typescript
// Manter selectedOS sincronizado com dados frescos do servidor
useEffect(() => {
  if (selectedOS && workOrders.length > 0) {
    const updated = workOrders.find(wo => wo.id === selectedOS.id);
    if (updated) {
      setSelectedOS(updated);
    }
  }
}, [workOrders]);
```

Isso garante que quando `invalidateQueries(['work-orders'])` dispara o refetch e a lista `workOrders` é atualizada, o `selectedOS` é automaticamente atualizado com os dados frescos (novo status, novo `total_time_seconds`, etc.), e o dialog reage imediatamente.

Nenhuma outra alteração necessária — o `DetalheOSDialog` já usa `workOrder.total_time_seconds` e `workOrder.status` corretamente; o problema é exclusivamente que ele recebe dados obsoletos.

