

## Problema

Dois bugs no `ConsumedPartsBlock.tsx`:

1. **Catálogo de peças manual**: `availableParts` usa `useQuery` sem fallback offline → dialog "Adicionar Peça" abre vazio quando offline.

2. **Peças automáticas (NC+Troca) não aparecem na lista**: O `useOfflineQuery` no `ConsumedPartsBlock` não reage a mudanças no Dexie. Quando `ChecklistExecution` insere um `partConsumption` local, o `ConsumedPartsBlock` não atualiza porque `queryClient.invalidateQueries` não dispara o `offlineFn` do `useOfflineQuery` (este só responde ao seu próprio `refetchOffline`).

## Correção

### Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`

**1. Peças automáticas — usar `useLiveQuery` do Dexie para dados offline**

Substituir o `useOfflineQuery` por uma abordagem híbrida:
- Quando online: `useQuery` normal (Supabase)
- Quando offline: `useLiveQuery` do `dexie-react-hooks` apontando para `offlineChecklistDb.partConsumptions`

`useLiveQuery` é reativo — qualquer `put`/`delete` no Dexie dispara re-render automaticamente. Isso resolve o problema de peças automáticas não aparecendo.

Implementação:
```tsx
import { useLiveQuery } from "dexie-react-hooks";

const [isOnline, setIsOnline] = useState(navigator.onLine);
// ... listener online/offline

// Online data
const { data: onlineParts, isLoading: onlineLoading } = useQuery({
  queryKey: ['preventive-consumed-parts', preventiveId],
  queryFn: async () => { /* existing Supabase fetch */ },
  enabled: !!preventiveId && isOnline,
});

// Offline data (reactive via Dexie)
const offlineParts = useLiveQuery(
  () => isOnline ? Promise.resolve([]) :
    offlineChecklistDb.partConsumptions
      .filter(pc => pc.preventive_id === preventiveId)
      .toArray(),
  [preventiveId, isOnline]
);

// Merge: use online if available, otherwise offline mapped
const parts = isOnline && onlineParts ? onlineParts : offlineParts?.map(item => ({
  id: item.id,
  part_id: item.part_id,
  part_code_snapshot: item.part_code_snapshot,
  part_name_snapshot: item.part_name_snapshot,
  quantity: item.quantity,
  unit_cost_snapshot: null,
  stock_source: item.stock_source as ConsumedPart['stock_source'],
  asset_unique_code: null,
  notes: null,
  is_manual: false,
  consumed_at: new Date().toISOString(),
  is_asset: false,
}));
const isLoading = isOnline ? onlineLoading : offlineParts === undefined;
```

**2. Catálogo de peças manual — fallback offline via `offlineDb.pecas`**

Substituir o `useQuery` de `availableParts` (linha 100-113) por `useOfflineQuery` ou `useLiveQuery` com fallback para `offlineDb.pecas`:

```tsx
import { offlineDb } from "@/lib/offline-db";

const { data: availableParts } = useOfflineQuery({
  queryKey: ['parts-catalog-active'],
  queryFn: async () => {
    /* existing Supabase fetch */
  },
  offlineFn: async () => {
    return offlineDb.pecas
      .filter(p => p.ativo !== false)
      .toArray()
      .then(items => items.map(p => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        familia: p.familia ?? null,
        is_asset: false,
      })));
  },
  enabled: isAddDialogOpen,
});
```

### Mudanças necessárias

| Arquivo | Mudança |
|---------|---------|
| `ConsumedPartsBlock.tsx` | Substituir `useOfflineQuery` de consumed parts por `useQuery` + `useLiveQuery` (híbrido reativo) |
| `ConsumedPartsBlock.tsx` | Substituir `useQuery` de `availableParts` por `useOfflineQuery` com fallback Dexie |

Nenhuma mudança em `ChecklistExecution.tsx` ou no Dexie DB — a lógica de criação dos part consumptions já está correta, o problema era apenas a leitura/exibição.

