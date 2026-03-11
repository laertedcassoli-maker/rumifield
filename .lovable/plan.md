

## Pre-cache de Checklists no Sync Global

### Problema

O checklist so e cacheado no `offlineChecklistDb` quando o usuario abre a tela `ChecklistExecution` online (linha 136). Se ele nunca abriu, o cache nao existe e o checklist nao funciona offline.

### Solucao

Adicionar uma etapa no sync global (`useOfflineSync.ts`) que, apos sincronizar `preventivas`, busca os checklists associados e os cacheia no `offlineChecklistDb`.

### Implementacao

**Arquivo: `src/hooks/useOfflineSync.ts`**

1. Importar `offlineChecklistDb` no topo do arquivo
2. Adicionar nova tabela `"checklists"` ao array de sync (apos `"preventivas"`)
3. Criar case `"checklists"` no `syncTableFromServer`:

```typescript
case "checklists": {
  // Get all preventivas cached locally
  const cachedPreventivas = await offlineDb.preventivas.toArray();
  const preventiveIds = cachedPreventivas.map(p => p.id);
  
  if (preventiveIds.length === 0) break;

  // Fetch checklists for all cached preventivas (in batches to avoid query limits)
  const batchSize = 50;
  for (let i = 0; i < preventiveIds.length; i += batchSize) {
    const batch = preventiveIds.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('preventive_checklists')
      .select(`
        *,
        template:checklist_templates(name),
        blocks:preventive_checklist_blocks(
          id, block_name_snapshot, order_index,
          items:preventive_checklist_items(
            id, item_name_snapshot, order_index, status, notes, answered_at, template_item_id,
            selected_actions:preventive_checklist_item_actions(id, template_action_id, action_label_snapshot),
            selected_nonconformities:preventive_checklist_item_nonconformities(id, template_nonconformity_id, nonconformity_label_snapshot)
          )
        )
      `)
      .in('preventive_id', batch);
    
    if (error) throw error;
    
    for (const checklist of data || []) {
      await offlineChecklistDb.cacheFullChecklist(checklist);
    }
  }
  break;
}
```

4. Adicionar `"checklists"` ao array `tables` no `syncAll` (apos `"preventivas"`):
```typescript
const tables = [
  "clientes", "pecas", "produtos_quimicos", "visitas", "estoque", 
  "pedidos", "chamados", "preventivas", "checklists", // <-- aqui
  "corretivas", "rotas", "rota_items"
];
```

### O que isso resolve

- Ao fazer sync online (automatico ou manual), todos os checklists das preventivas cacheadas sao baixados e salvos no `offlineChecklistDb`
- Ao abrir o app offline, o checklist ja esta disponivel sem nunca ter sido aberto individualmente
- O `cacheFullChecklist` ja respeita `_pendingSync` (nao sobrescreve alteracoes locais pendentes)
- Nenhuma alteracao nos demais arquivos

