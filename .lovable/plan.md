

## Suporte Offline Real para Minhas Rotas

### Problema
As páginas `MinhasRotas.tsx` e `ExecucaoRota.tsx` buscam dados exclusivamente via Supabase/React Query. Quando offline, exibem loading infinito ou erro. Os dados ja sao sincronizados para Dexie (`rotas`, `rota_items`, `clientes`) mas nunca consumidos.

### Abordagem
Criar um hook `useOfflineQuery` que tenta buscar do servidor e, em caso de falha ou offline, retorna dados do Dexie como fallback. Aplicar esse padrão nas duas páginas.

### Arquivos a criar/editar

**1. Criar `src/hooks/useOfflineQuery.ts`** — hook genérico que:
- Usa React Query normalmente quando online
- Ao falhar ou quando offline, busca dados equivalentes do Dexie
- Retorna flag `isOfflineData` para exibir indicador visual

**2. Editar `src/pages/preventivas/MinhasRotas.tsx`**
- Importar `useOfflineQuery` e `offlineDb`
- Na query de rotas preventivas: adicionar fallback que lê `offlineDb.rotas` filtrando por técnico, enriquecendo com `offlineDb.rota_items` e `offlineDb.clientes` para coordenadas
- Na query de visitas corretivas: fallback lendo `offlineDb.corretivas` filtrando por técnico
- Exibir badge `WifiOff` quando usando dados offline
- Desabilitar filtro de técnicos (query de profiles) quando offline

**3. Editar `src/pages/preventivas/ExecucaoRota.tsx`**
- Query da rota: fallback para `offlineDb.rotas.get(id)`
- Query dos items: fallback para `offlineDb.rota_items` filtrados por `route_id`, enriquecidos com dados de `offlineDb.clientes`
- Check-in offline: salvar no Dexie e adicionar à sync queue para enviar quando reconectar
- Cancelamento offline: mesma estratégia — salvar localmente e enfileirar
- Exibir indicador visual de modo offline

### Detalhes técnicos

O hook `useOfflineQuery` encapsula o padrão:
```text
┌─────────────┐    online?    ┌──────────┐
│ React Query │──── sim ─────▶│ Supabase │
│  queryFn    │               └──────────┘
│             │──── falha ───▶┌──────────┐
│             │               │  Dexie   │
│             │◀── offline ──▶│ (local)  │
└─────────────┘               └──────────┘
```

Para mutations offline (check-in, cancelamento), o fluxo:
1. Atualizar `offlineDb.rota_items` localmente
2. Adicionar operação à `offlineDb.syncQueue`
3. Invalidar query local para refletir mudança
4. Quando online, `syncAll` processa a fila

A sync de `rota_items` no `useOfflineSync.ts` já inclui `client_name`, `client_fazenda`, `client_lat`, `client_lon` — dados suficientes para `ExecucaoRota`. Precisaremos adicionar `cidade`, `estado`, `link_maps` à sync de `rota_items` e ao tipo `OfflineRotaItem`.

### Mudanças no schema offline (`offline-db.ts`)
- Adicionar campos `client_cidade`, `client_estado`, `client_link_maps` ao `OfflineRotaItem`

### Mudanças no sync (`useOfflineSync.ts`)
- Na sync de `rota_items`, buscar também `cidade, estado, link_maps` dos clientes

