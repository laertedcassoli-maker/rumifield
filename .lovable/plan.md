

## Bug: Clicar na NC não marca (offline)

### Causa raiz

Quando offline, o ciclo de atualização da UI para NCs/ações é:

1. Click → `toggleNonconformityMutation.mutate()` → escreve no Dexie
2. `onSuccess` → `refetchOffline()` → leitura assíncrona do Dexie → `setOfflineData()`
3. Re-render com dados atualizados

O problema: **não há atualização otimista** para seleções de NC/ações. A UI depende inteiramente do ciclo assíncrono `refetchOffline → Dexie read → setState`. Diferente do status do item (que tem `optimisticStatuses`), as seleções de NC/ação não têm estado otimista. O re-render pode não refletir a mudança visualmente, ou o `refetchOffline` pode ter timing issues com o `useOfflineQuery` (que depende de `shouldFallback` e efeitos assíncronos).

### Solução

Adicionar **estado otimista local** para seleções de NC e ações, idêntico ao padrão já usado para `optimisticStatuses`.

### Alterações em `ChecklistExecution.tsx`

**1. Novo estado otimista:**
```ts
const [optimisticNcSelections, setOptimisticNcSelections] = 
  useState<Record<string, Set<string>>>({});
const [optimisticActionSelections, setOptimisticActionSelections] = 
  useState<Record<string, Set<string>>>({});
```

**2. Atualizar otimisticamente no onClick (antes do mutate):**
No handler de click da NC, antes de chamar `toggleNonconformityMutation.mutate()`:
```ts
setOptimisticNcSelections(prev => {
  const current = new Set(prev[item.id] || item.selectedNonconformities);
  if (isSelected) current.delete(nc.id); else current.add(nc.id);
  return { ...prev, [item.id]: current };
});
```
Idem para ações.

**3. Usar no cálculo de `selectedNonconformities` e `selectedActions`:**
No mapeamento de blocos (linha ~929-938), substituir:
```ts
selectedActions: optimisticActionSelections[item.id] 
  ? [...optimisticActionSelections[item.id]]
  : item.selected_actions?.map(...) || [],
selectedNonconformities: optimisticNcSelections[item.id]
  ? [...optimisticNcSelections[item.id]]
  : item.selected_nonconformities?.map(...) || [],
```

**4. Reconciliar quando dados do servidor/Dexie atualizam:**
Limpar entradas otimistas quando `existingChecklist` muda (dados reais chegaram):
```ts
useEffect(() => {
  setOptimisticNcSelections({});
  setOptimisticActionSelections({});
}, [existingChecklist]);
```

**5. Usar `isSelected` a partir do estado otimista no render:**
No render das NCs (~L1256), `isSelected` já vem de `item.selectedNonconformities.includes(nc.id)`, que agora refletirá o estado otimista.

### Resultado esperado
- Click na NC → marca imediatamente (otimista)
- Dados salvos no Dexie em background
- Quando `refetchOffline` retorna, estado otimista é limpo e dados reais assumem
- Funciona online e offline sem delay perceptível

### Arquivo alterado
- `src/components/preventivas/ChecklistExecution.tsx`

