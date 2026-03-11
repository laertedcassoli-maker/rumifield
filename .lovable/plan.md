

## Diagnóstico: "Checklist não disponível offline" ao abrir app já em modo avião

### Causa raiz

O problema está na **cadeia de dependências** para resolver o `preventiveId`:

```text
AtendimentoPreventivo (offlineFn)
  → offlineDb.rota_items.get(itemId)     ✓ pode funcionar
  → offlineDb.preventivas.filter(...)     ← PROBLEMA: tabela pode estar vazia
  → preventiveId = null
  → ChecklistExecution recebe preventiveId=null
  → offlineChecklistDb.getCachedChecklist(null) retorna null
  → "Checklist não disponível offline"
```

A tabela `preventivas` no Dexie ainda usa `clear()` antes de `bulkPut` (linha 182 do `useOfflineSync.ts`). Se o último sync falhou ou o app foi fechado no momento errado, a tabela fica vazia. O mesmo ocorre com `rota_items` (linha 324).

O checklist em si **está cacheado** no `offlineChecklistDb` (foi salvo quando o usuário abriu online). Mas o `preventiveId` necessário para buscá-lo não é encontrado porque a tabela `preventivas` do Dexie principal está vazia.

### Alterações necessárias

**1. `src/hooks/useOfflineSync.ts` — Remover `clear()` de `preventivas` e `rota_items`**

Mesma correção já aplicada para `rotas`:
- Linha 182: remover `await offlineDb.preventivas.clear()` — usar apenas `bulkPut` (upsert)
- Linha 324: remover `await offlineDb.rota_items.clear()` — usar apenas `bulkPut` (upsert)

Isso garante que dados previamente cacheados sobrevivem a syncs com resultado vazio ou falhas.

**2. Aplicar a mesma correção para todas as demais tabelas que ainda usam `clear()`** (consistência)

Verificar e remover `clear()` de: `clientes`, `pecas`, `produtos_quimicos`, `visitas`, `estoque`, `pedidos`, `chamados`, `corretivas`. Todas devem usar apenas `bulkPut` (upsert) para preservar cache existente.

### Resumo das mudanças

Arquivo único: `src/hooks/useOfflineSync.ts`

Remover toda ocorrência de `await offlineDb.<tabela>.clear()` antes de `bulkPut`, em todas as tabelas sincronizadas. O padrão correto já foi validado na correção de `rotas`: só fazer `bulkPut` se houver dados, e não limpar se não houver.

