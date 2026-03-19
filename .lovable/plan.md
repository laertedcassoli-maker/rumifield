

## Implementação dos 5 bugs (A-E)

### Arquivo 1: `src/pages/preventivas/NovaRota.tsx`

**Bug A** — Adicionar `order_index: index` ao map de items (linhas 477-485).

**Bug B** — Declarar `let createdRouteId: string | null = null` antes do try. Setar após insert da rota (linha 474). No catch (linhas 496-501), deletar rota órfã antes do toast.

### Arquivo 2: `src/pages/preventivas/DetalheRota.tsx`

**Bug C** — Linha 234-237: trocar `.insert(preventiveRecords)` por `.upsert(preventiveRecords, { onConflict: 'client_id,route_id', ignoreDuplicates: false })`.

### Arquivo 3: `src/hooks/useOfflineSync.ts`

**Bug D** — Adicionar handlers no `processSyncItem`:
- **insert** (após linha 514): handlers para `preventive_maintenance` (upsert com `client_id,route_id`) e `preventive_route_items` (upsert com `id`). Fallback `else` com throw.
- **update** (após linha 557): handler para `preventive_maintenance`. Fallback `else` com throw.
- **delete** (após linha 572): fallback `else` com throw.

**Bug E** — Linhas 625-639: substituir `Promise.all` único por 3 fases sequenciais:
1. `Promise.all` com dados de referência (clientes, pecas, etc + corretivas, rotas, rota_items)
2. `await syncTableFromServer("preventivas")`
3. `await syncTableFromServer("checklists")`

