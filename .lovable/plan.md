

## Diagnóstico

O `ConsumedPartsBlock` usa `useQuery` direto no Supabase — sem fallback offline. Os part consumptions criados localmente no Dexie (`offlineChecklistDb.partConsumptions`) nunca são lidos pela UI quando offline.

Fluxo atual:
1. Técnico offline seleciona NC + Troca → `partConsumptions` é salvo no Dexie ✅
2. `ConsumedPartsBlock` faz `useQuery` → Supabase → falha offline → lista vazia ❌

## Correção

### Arquivo 1: `src/components/preventivas/ConsumedPartsBlock.tsx`

Substituir o `useQuery` de `preventive-consumed-parts` por `useOfflineQuery`, com fallback que lê de `offlineChecklistDb.partConsumptions`:

- Import `useOfflineQuery` e `offlineChecklistDb`
- `offlineFn`: buscar `partConsumptions` onde `preventive_id === preventiveId` (usando filter, já que não tem índice por preventive_id), mapear para o formato `ConsumedPart` (campos como `is_manual: false`, `consumed_at`, `unit_cost_snapshot: null`, `asset_unique_code: null`)
- O fetch de `is_asset` do `pecas` não é possível offline — definir `is_asset: false` como fallback (dados de referência secundários)

### Arquivo 2: `src/lib/offline-checklist-db.ts`

Adicionar método helper para buscar part consumptions por preventive_id:

```ts
async getPartConsumptionsByPreventiveId(preventiveId: string): Promise<OfflinePartConsumption[]> {
  return this.partConsumptions
    .filter(pc => pc.preventive_id === preventiveId)
    .toArray();
}
```

### Arquivo 3: `src/components/preventivas/ConsumedPartsBlock.tsx` (continuação)

Também precisamos que, quando online, os dados locais pendentes sejam mergeados com os dados do servidor para exibição imediata (antes do sync). Isso evita o cenário onde o técnico volta online mas a peça só aparece após o sync.

Alternativamente, como o `useOfflineQuery` já resolve isso (usa dados do servidor quando online e dados locais quando offline), e o sync é disparado automaticamente ao voltar online, o merge não é estritamente necessário — mas os dados aparecerão instantaneamente offline.

### Resumo das mudanças

1. **`src/lib/offline-checklist-db.ts`**: Novo método `getPartConsumptionsByPreventiveId`
2. **`src/components/preventivas/ConsumedPartsBlock.tsx`**: Trocar `useQuery` por `useOfflineQuery` com fallback Dexie; adicionar imports; mapear dados offline para o formato `ConsumedPart`

