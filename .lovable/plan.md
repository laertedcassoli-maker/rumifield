

## Implementar Estado Otimista no Checklist (Cenário A)

### Alteração única: `src/components/preventivas/ChecklistExecution.tsx`

**3 pontos de mudança:**

1. **Declarar estado otimista** (após as declarações de state existentes, ~linha 70):
```tsx
const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, 'S' | 'N' | 'NA'>>({});
```

2. **Atualizar estado otimista na mutation** (linha 391, dentro do `mutationFn`, antes de `offlineChecklist.updateItem`):
```tsx
if (status) {
  setOptimisticStatuses(prev => ({ ...prev, [itemId]: status }));
}
```

3. **Aplicar merge no mapeamento de blocks** (linha 949-950):
```tsx
items: block.items?.map((item: any) => ({
  ...item,
  status: optimisticStatuses[item.id] ?? item.status,
  // resto igual
```

Nenhum outro arquivo alterado. O `refetchOffline()` continua existindo como reconciliação em background.

