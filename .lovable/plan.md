

## Bug: Não-conformidades não aparecem offline ao marcar "Falha"

### Causa raiz

As queries `templateActions` (L161) e `templateNonconformities` (L202) em `ChecklistExecution.tsx` usam `useQuery` padrão com chamadas diretas ao Supabase — **sem fallback offline**. Quando offline:

1. `useQuery` fica desabilitado (ou falha)
2. `templateNonconformities` retorna `undefined`
3. Na linha 923: `availableNonconformities: templateNonconformities?.[item.template_item_id] || []` → sempre `[]`
4. UI não tem opções para mostrar

### Solução

**Duas partes:**

**1. Cachear ações corretivas e não-conformidades no Dexie** (`offline-checklist-db.ts`)
- Adicionar duas novas tabelas: `templateActions` e `templateNonconformities` (dados de referência do template)
- No `cacheFullChecklist`, também salvar essas referências quando disponíveis
- Criar método `getCachedTemplateActions(templateItemIds)` e `getCachedTemplateNonconformities(templateItemIds)`

**2. Converter as queries para `useOfflineQuery`** (`ChecklistExecution.tsx`)
- Substituir `useQuery` por `useOfflineQuery` para `templateActions` e `templateNonconformities`
- Fornecer `offlineFn` que busca do Dexie

**3. Popular o cache quando online** (`ChecklistExecution.tsx`)
- No `queryFn` de cada query, após buscar do Supabase, salvar os dados no Dexie para uso futuro offline

### Arquivos alterados
- `src/lib/offline-checklist-db.ts` — novas tabelas + métodos de cache/leitura (versão 3 do schema Dexie)
- `src/components/preventivas/ChecklistExecution.tsx` — converter 2 queries para `useOfflineQuery`

