

## Correção: Flickering ao limpar estado otimista

### Alteração única em `ChecklistExecution.tsx` (linhas 387-391)

Substituir o `useEffect` que limpa tudo de uma vez por limpeza granular por item — só remove o estado otimista de um item quando os dados reais desse item já estão presentes no `existingChecklist`:

```ts
useEffect(() => {
  if (!existingChecklist) return;
  existingChecklist.blocks?.forEach((block: any) => {
    block.items?.forEach((item: any) => {
      setOptimisticNcSelections(prev => {
        if (!prev[item.id]) return prev;
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setOptimisticActionSelections(prev => {
        if (!prev[item.id]) return prev;
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    });
  });
}, [existingChecklist]);
```

Isso garante que o estado otimista de cada item só é removido quando os dados reais daquele item específico já estão no cache, eliminando o frame intermediário onde nem o otimista nem o real estão presentes.

