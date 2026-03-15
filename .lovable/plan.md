## Diagnóstico

### Bug 1: Peças automáticas não aparecem (NC + Troca)

O problema é uma **race condition**. A lógica de offline-first salva a NC/ação no Dexie e agenda sync em 2s. Mas o código de side-effects (criar `part_consumption`) roda **imediatamente** e consulta o **Supabase** (onde a NC ainda não existe). Resultado: `newNc` retorna `null` → nenhuma peça criada.

Acontece tanto online quanto offline porque os caminhos online (linhas 757-816) consultam Supabase esperando dados que ainda estão só no Dexie.

**Correção**: Unificar os dois caminhos (online/offline) para usar **sempre Dexie** na lógica de part consumption. O sync queue já cuida de enviar para o servidor.

### Bug 2: Adição manual congela em "Adicionando"

`addManualPartMutation` faz `supabase.insert()` direto. Quando offline, o request fica pendente indefinidamente → botão trava no spinner.

**Correção**: Quando offline, salvar no Dexie via `addPartConsumptionLocally` com flag `is_manual: true`.

## Mudanças

### Arquivo 1: `src/components/preventivas/ChecklistExecution.tsx`

**toggleNonconformityMutation (linhas 757-862)**: Remover a bifurcação online/offline. Usar **sempre** a lógica Dexie para criar/remover part consumption:

- Ao **adicionar** NC: checar `itemHasTrocaAction` via Dexie → se sim, buscar NC parts do Dexie (`getNonconformityParts`) → `addPartConsumptionLocally`
- Ao **remover** NC: `deletePartConsumptionByNcId` via Dexie

**toggleActionMutation (linhas 635-698)**: Mesmo pattern — remover bifurcação online/offline:

- Ao **adicionar** Troca: buscar NCs selecionadas do Dexie → para cada, criar part consumption localmente
- Ao **remover** Troca: `deletePartConsumptionByItemId` via Dexie

**itemHasTrocaAction (linhas 524-543)**: Simplificar para usar **sempre** Dexie `checklistActions` (remover leitura de `existingChecklist?.blocks` que pode estar desatualizado)

### Arquivo 2: `src/components/preventivas/ConsumedPartsBlock.tsx`

**addManualPartMutation (linhas 240-272)**: Adicionar suporte offline:

```tsx
mutationFn: async () => {
  if (!selectedPartId || !selectedPart) throw new Error('Selecione uma peça');
  
  if (!isOnline) {
    // Save locally via Dexie
    await offlineChecklistDb.addPartConsumptionLocally({
      id: crypto.randomUUID(),
      preventive_id: preventiveId,
      part_id: selectedPartId,
      part_code_snapshot: selectedPart.codigo,
      part_name_snapshot: selectedPart.nome,
      quantity: parseFloat(quantity) || 1,
      stock_source: stockSource,
      exec_item_id: '',       // manual, no item
      exec_nonconformity_id: '', // manual, no NC
    });
    return;
  }
  
  // Online: existing Supabase insert...
}
```

### Arquivo 3: `src/lib/offline-checklist-db.ts`

Nenhuma mudança estrutural necessária — os métodos `addPartConsumptionLocally`, `deletePartConsumptionByNcId`, `deletePartConsumptionByItemId`, `getNonconformityParts` já existem.  
  
Além das mudanças propostas, aplicar o mesmo padrão offline-first 

nas demais mutations do ConsumedPartsBlock.tsx:

deleteManualPartMutation:

- Offline: deletar do Dexie + addToSyncQueue('preventive_part_consumption', 'delete', { id })

- Online: Supabase direto

updateStockSourceMutation:

- Offline: partConsumptions.update(id, { stock_source, _pendingSync: true }) 

  + addToSyncQueue('preventive_part_consumption', 'update', { id, stock_source })

- Online: Supabase direto

updateNotesMutation:

- Mesmo padrão com campo notes

updateAssetCodeMutation (se existir):

- Mesmo padrão com campo asset_unique_code

Em todos os casos: tentar Supabase se online, mas nunca bloquear a UI 

aguardando resposta — o Dexie é sempre atualizado primeiro.

&nbsp;