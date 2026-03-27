
## Correção do problema persistente de COR no mobile (sem depender de sync forçado)

### Diagnóstico confirmado

Há **duas causas raiz**:

1. **Nova COR não aparece imediatamente na lista**  
   Hoje a tela `MinhasRotas` usa `useOfflineQuery` para corretivas. Mesmo com insert no backend e escrita no Dexie, quando a query online responde com snapshot antigo (ou permanece “fresh” por `staleTime`), a UI continua mostrando dado antigo até novo refresh/sync.

2. **Check-in confirma (toast), mas não libera início do atendimento**  
   Em `ExecucaoVisitaCorretiva`, o registro `preventive_maintenance` (necessário para checklist/blocos) é criado por efeito colateral no `queryFn` de leitura.  
   Como o `onSuccess` do check-in está evitando refetch imediato (`refetchType: 'none'`), esse `queryFn` não roda no momento certo — então a visita fica sem `preventiveId` até forçar sincronização.

---

### Plano de implementação (focado em reduzir dependência de cache/offline)

#### 1) Tornar corretivas mais “online-first” em Minhas Rotas
**Arquivo:** `src/pages/preventivas/MinhasRotas.tsx`

- Separar o carregamento de corretivas para `useQuery` (não `useOfflineQuery`), mantendo offline apenas para preventivas.
- Para corretivas:
  - `staleTime: 0`
  - `refetchOnMount: 'always'`
  - `refetchOnReconnect: true`
- Resultado: reduz retenção de snapshot antigo e diminui necessidade de “forçar sync” para COR.

#### 2) Atualização imediata da lista após criar nova COR (sem depender de Dexie)
**Arquivo:** `src/components/chamados/NovaVisitaDiretaDialog.tsx`

- Remover dependência de `offlineDb.corretivas.put(...)` para refletir na lista.
- No `onSuccess`, aplicar **atualização otimista no cache React Query** da chave exata de corretivas (`['my-corrective-visits', userId, isAdminOrCoordinator]`), inserindo a nova visita no topo.
- Em seguida, `invalidateQueries` da mesma chave para reconciliação com backend.
- Resultado: nova visita aparece imediatamente, mesmo em condição de latência/replicação.

#### 3) Garantir criação do vínculo de execução no próprio check-in
**Arquivo:** `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

- Mover a garantia de criação/obtenção de `preventive_maintenance` para dentro da `checkinMutation` (após atualizar `ticket_visits` para `em_execucao`), em vez de depender de refetch do `queryFn`.
- No `onSuccess`:
  - atualizar cache de `['corrective-visit-execution', visitId]` com `checkin_at`, `status: 'em_execucao'` e `preventiveId`.
  - atualizar também listas `['my-corrective-visits', ...]` via `setQueriesData` (status da visita em memória).
- Manter invalidação para reconciliação, mas sem quebrar o estado imediato da tela.
- Resultado: após toast de check-in, atendimento abre na hora, sem sync manual.

#### 4) Remover side effect crítico do `queryFn` de leitura
**Arquivo:** `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

- Reduzir lógica de criação de registros dentro da query de leitura (deixar leitura o mais pura possível).
- Se necessário, manter apenas fallback defensivo para casos legados, sem depender disso para o fluxo principal de check-in.

---

### Validação (E2E mobile)

1. Criar nova COR em `/preventivas/minhas-rotas` e confirmar que aparece imediatamente na lista (sem forçar sync).
2. Abrir a COR criada, fazer check-in e confirmar que:
   - botão de check-in não reaparece,
   - conteúdo de atendimento/checklist abre sem sync manual.
3. Repetir com rede oscilante (3G/4G) para garantir resiliência sem depender do banco offline para COR.
4. Confirmar que preventivas continuam com comportamento atual (sem regressão).

---

### Impacto esperado

- Corrige os dois sintomas reportados (criação e check-in de COR).
- Alinha com sua premissa: **menos dependência de cache/offline para corretivas**.
- Mantém experiência responsiva em mobile, com consistência entre UI e backend.
