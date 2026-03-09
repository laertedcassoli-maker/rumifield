

## Corrigir "Nenhuma fazenda nesta rota" offline — dados não persistindo no Dexie

### Diagnóstico

As rotas PREV-2026-00004 e PREV-2026-00007 têm 4 e 6 fazendas respectivamente no banco. Porém, offline mostram "0/0" na listagem e "Nenhuma fazenda" no detalhe. O problema está no sync, não no `useOfflineQuery`.

### Causa raiz

No `useOfflineSync.ts`, o sync de `rota_items` (e outras tabelas) faz `clear()` **antes** de verificar se novos dados chegaram:

```typescript
// rota_items sync (linha 325-328)
await offlineDb.rota_items.clear();          // ← apaga tudo
await offlineDb.rota_items.bulkPut(enriched); // ← insere novos

// MAS se result.data?.length é falsy:
await offlineDb.rota_items.clear();          // ← apaga tudo e não repõe
```

Cenários que causam perda de dados:
1. Sync roda mas a query retorna erro (timeout, rede instável) → `throw` → catch → dados já foram apagados no sync anterior
2. `Promise.all` executa todos os syncs em paralelo — `rotas` pode completar mas `rota_items` falhar
3. A query inline de items dentro do sync de `rotas` (para contagem) não verifica `itemsRes.error`, resultando em "0/0"

### Solução

**Arquivo: `src/hooks/useOfflineSync.ts`**

1. **Não limpar dados existentes se a nova busca falhar**: Mover o `clear()` para DEPOIS de confirmar que novos dados foram recebidos. Padrão: "só substitui se tem dados novos"

2. **Verificar `itemsRes.error`** na contagem inline do sync de `rotas`

Aplicar o padrão seguro em TODAS as tabelas do sync:

```typescript
// ANTES (perigoso):
await offlineDb.rota_items.clear();
await offlineDb.rota_items.bulkPut(enriched);
// ...
} else {
  await offlineDb.rota_items.clear(); // apaga sem reposição
}

// DEPOIS (seguro):
if (result.data?.length) {
  const enriched = ...;
  await offlineDb.rota_items.clear();
  await offlineDb.rota_items.bulkPut(enriched);
}
// Se não tem dados novos, MANTÉM os dados existentes no Dexie
```

3. No sync de `rotas`, verificar erro da query de items:
```typescript
const [itemsRes, profilesRes] = await Promise.all([...]);
// Adicionar: if (!itemsRes.error) { ... contar ... }
```

### Tabelas afetadas
Aplicar o mesmo padrão seguro para: `clientes`, `pecas`, `produtos_quimicos`, `chamados`, `preventivas`, `corretivas`, `rotas`, `rota_items`

### Arquivo alterado
- `src/hooks/useOfflineSync.ts` — remover `clear()` no branch `else` de todas as tabelas + verificar erros na query inline de items

