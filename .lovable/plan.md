

## Refatorar Pedidos para 100% Online

Eliminar toda a camada offline (Dexie, sync queue, useLiveQuery) do módulo de Pedidos e corrigir bugs de robustez. Supabase como fonte única de verdade, React Query como cache reativo.

---

### FASE 1 — Eliminar camada offline

**1A. Reescrever `Pedidos.tsx`** (~1650 linhas)

- Remover imports: `useLiveQuery`, `offlineDb`, `useOfflinePedidos`, `useOffline`
- Remover referências a `triggerSync`, `pushChanges`, `isOnline`, `syncStatus`, `lastSyncTime`
- Remover badge offline e texto de sync status
- Substituir `clientes` e `pecas` (via `useLiveQuery`/Dexie) por `useQuery` do React Query buscando do Supabase
- Substituir `pedidos` (via `useOfflinePedidos`) por `useQuery` com joins (clientes, pedido_itens, pecas, workshop_items, profiles)
- Converter `createPedido`, `updatePedido`, `transmitirPedido`, `transmitirTodos`, `deletePedido` em `useMutation` diretas ao Supabase com `invalidateQueries(['pedidos'])` no `onSuccess`
- `handleProcessar` / `handleConcluir`: remover `offlineDb.pedidos.update()` e `setTimeout(() => triggerSync())`, usar `invalidateQueries`
- `handleAssetLinked`: remover update Dexie, manter update do state local + `invalidateQueries`

**1B. Deletar `src/hooks/useOfflinePedidos.ts`**

**1C. Atualizar imports em arquivos dependentes**

- `ProcessarPedidoDialog.tsx`, `ConcluirPedidoDialog.tsx`, `PedidoKanban.tsx`: mover tipo `PedidoComItens` para novo arquivo `src/types/pedidos.ts`
- `useOfflineSync.ts`: remover import de `syncPedidosFromServer` e o case `"pedidos"` do sync
- `EditarPedidoSolicitado.tsx`: substituir `useLiveQuery`/`offlineDb.pecas` por `useQuery` do Supabase

**1D. Limpar `offline-db.ts`**

- Remover tabelas `pedidos` e `pedido_itens` da definição Dexie (manter as demais)

---

### FASE 2 — Corrigir bugs de robustez

**2A.** `handleProcessar` / `handleConcluir`: capturar erros individuais no loop de asset associations

**2B.** `EditarPedidoSolicitado.tsx`: capturar erros em cada operação Supabase. Tratar re-fetch que falha gracefully.

**2C.** `AssetSearchField.tsx`: debounce de 300ms na busca via `useDebounce`. Usar `upsert` com `onConflict: 'unique_code'` ao criar asset.

**2D.** `ConcluirPedidoDialog.tsx` e `ProcessarPedidoDialog.tsx`: `useRef` guard contra double-click.

---

### FASE 3 — Limpeza

- Remover imports órfãos em todos os arquivos modificados
- Verificar build sem erros

---

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/pages/Pedidos.tsx` | Rewrite principal |
| `src/hooks/useOfflinePedidos.ts` | Deletar |
| `src/types/pedidos.ts` | Criar (tipo PedidoComItens) |
| `src/components/pedidos/EditarPedidoSolicitado.tsx` | Remover Dexie, error handling |
| `src/components/pedidos/AssetSearchField.tsx` | Debounce + upsert |
| `src/components/pedidos/ConcluirPedidoDialog.tsx` | Double-click guard |
| `src/components/pedidos/ProcessarPedidoDialog.tsx` | Double-click guard |
| `src/components/pedidos/PedidoKanban.tsx` | Atualizar import tipo |
| `src/hooks/useOfflineSync.ts` | Remover ref pedidos |
| `src/lib/offline-db.ts` | Remover tabelas pedidos |

### Não será alterado

- Nenhum outro módulo (preventivas, chamados, CRM, oficina, estoque)
- Layout, estilos, campos de formulário
- Estrutura de tabelas ou RLS no Supabase

