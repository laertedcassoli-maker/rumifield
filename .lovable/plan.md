

## Corrigir "Atendimento não encontrado" offline

### Problema
A página `AtendimentoPreventivo.tsx` usa `useQuery` padrão (Supabase) sem fallback offline. Quando o técnico clica "Continuar" offline, a query falha e exibe "Atendimento não encontrado".

### Causa raiz
- `ExecucaoRota.tsx` já usa `useOfflineQuery` com fallback Dexie — funciona offline
- `AtendimentoPreventivo.tsx` usa `useQuery` direto — falha offline
- A query faz 4 chamadas Supabase (route_item, route, client, preventive_maintenance) — todas falham sem rede

### Solução
Converter a query principal de `AtendimentoPreventivo.tsx` para usar `useOfflineQuery`, com fallback que monta os dados a partir do Dexie (tabelas `rota_items`, `rotas`, `clientes` já cacheadas pelo sync).

**Mudanças em `src/pages/preventivas/AtendimentoPreventivo.tsx`:**

1. Importar `useOfflineQuery` e `offlineDb`
2. Substituir `useQuery` por `useOfflineQuery` com `offlineFn` que:
   - Busca o item no Dexie (`rota_items`)
   - Busca a rota no Dexie (`rotas`)
   - Busca o cliente no Dexie (`clientes`)
   - Monta o objeto de retorno com os dados disponíveis localmente
   - Para `preventiveId`, tenta buscar do Dexie ou retorna null (será criado quando voltar online)
3. Adicionar badge "Offline" no header quando offline
4. Desabilitar "Encerrar Visita" quando offline (requer múltiplas operações server-side)

**Mudanças em `src/lib/offline-db.ts`** (se necessário):
- Verificar se a tabela `clientes` já está cacheada no Dexie — provavelmente sim pelo sync existente

