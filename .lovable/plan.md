

## Corrigir erro "no unique or exclusion constraint matching ON CONFLICT"

### Causa raiz
O índice `unique_client_route_preventive` é parcial: `UNIQUE (client_id, route_id) WHERE (route_id IS NOT NULL)`. O `ON CONFLICT` do Supabase JS não suporta cláusula `WHERE` de índices parciais, causando o erro.

### Correção

**Abordagem**: Em vez de `upsert`, usar lógica de "fetch existing + insert only missing" nos 2 pontos afetados.

#### 1. `src/pages/preventivas/DetalheRota.tsx` (Bug C revisado)

Substituir o `.upsert(...)` por:
1. Buscar preventivas existentes para este `route_id`: `SELECT id, client_id FROM preventive_maintenance WHERE route_id = ?`
2. Filtrar `preventiveRecords` removendo os que já existem (por `client_id`)
3. Se houver novos, fazer `.insert()` apenas dos novos
4. Combinar os existentes + novos para prosseguir com criação de checklists

#### 2. `src/hooks/useOfflineSync.ts` (handler de insert para `preventive_maintenance` no Bug D)

Mesma lógica: tentar `.insert()` e tratar erro `23505` (duplicate key) como sucesso, em vez de usar `.upsert()` com `onConflict`.

### Arquivos alterados
- `src/pages/preventivas/DetalheRota.tsx`
- `src/hooks/useOfflineSync.ts`

