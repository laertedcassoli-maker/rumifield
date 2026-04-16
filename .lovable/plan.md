
## Plano — Fase 1: eliminar camada offline do módulo Chamados

Apenas Fase 1 (online via React Query). Sem mudanças de layout, RLS, RPCs ou outros módulos além do necessário para não quebrar o build.

### 1A — `src/pages/chamados/Index.tsx`
- Remover imports `useOffline`, `useOfflineChamados`, `WifiOff`.
- Remover hooks `isOnline`, `offlineChamados`, `offlineLoading` e o `useMemo` `offlineTicketsConverted`.
- Remover o switch `tickets = isOnline ? ... : ...` e o badge `WifiOff` no header.
- Refatorar a `useQuery(['technical-tickets'])` única:
  - `enabled: !!user`, `staleTime: 30_000`, `refetchOnWindowFocus: true`.
  - Se `role !== 'admin' && role !== 'coordenador_servicos'`, aplicar `.eq('assigned_technician_id', user.id)` (defesa em profundidade além da RLS).
  - Manter o enrichment atual (clientes, profiles, contagem de visitas).
- `isLoading` passa a vir direto da query.

### 1B — Remover hooks/tabelas offline de Chamados
- Deletar `src/hooks/useOfflineChamados.ts` e `src/hooks/useOfflineCorretivas.ts`.
- `src/lib/offline-db.ts`: adicionar `version(7)` que dropa `chamados: null` e `corretivas: null`. Remover propriedades `chamados!`/`corretivas!` da classe e suas chamadas em `clearAll()`. Manter as interfaces `OfflineChamado`/`OfflineCorretiva` removidas (não são importadas em outro lugar após as alterações abaixo).
- `src/hooks/useOfflineSync.ts`: remover os `case "chamados"` e `case "corretivas"` dentro de `syncTableFromServer`, e tirar `"chamados"` e `"corretivas"` do array `phase1Tables` em `syncAll`.

### 1C — Atualizar `ClienteHistoricoTab.tsx` (consumidor cruzado)
Esse componente usa `useOfflineChamados`/`useOfflineCorretivas` para a aba Histórico do CRM. Como vamos deletar esses hooks, ele precisa ser ajustado:
- Remover imports de `useOfflineChamados` e `useOfflineCorretivas`.
- Remover os `useMemo` `offlineChamados` e `offlineCorretivas` e o fallback `isOnline ? online : offline` para chamados/corretivas — usar somente as queries online.
- Remover `enabled: !!clientId && isOnline` das queries de chamados/corretivas (passa a `enabled: !!clientId`).
- `useOfflinePreventivas` e seu fallback ficam intactos (fora do escopo da Fase 1).

### 1D — `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
- Conforme o briefing: o import de `offlineChecklistDb` é usado internamente para detectar peças locais ainda não sincronizadas durante a validação de finalização (linhas ~679 e ~699). Esse uso é do componente compartilhado de checklist, não da camada Dexie de chamados/corretivas.
- **Manter intacto** nesta fase. As correções de robustez/idempotência da `completeMutation` virão na Fase 2 (briefing futuro).

### Arquivos não tocados
- `useOfflineSync.ts` mantém `chamados`/`corretivas` removidos apenas dos arrays e do switch — todas as outras tabelas (clientes, pecas, preventivas, rotas, checklists, etc.) ficam idênticas.
- `supabase/functions/detect-code-changes/index.ts` referencia os hooks deletados como metadados; vou removê-los desse array para o detector parar de procurá-los.

### Verificações antes de finalizar
- `grep` final por `useOfflineChamados|useOfflineCorretivas|offlineDb\.(chamados|corretivas)` deve retornar zero resultados.
- Build TypeScript deve passar (tipos `OfflineChamado`/`OfflineCorretiva` não usados em lugar algum após edits).

### Fora do escopo (Fases 2–4 futuras)
- Rollback em `NovoChamado`, `NovaVisitaDiretaDialog`, `completeMutation`/`checkinMutation` da execução corretiva.
- Captura de erros silenciados em `NovaInteracaoDialog`, `FinalizarChamadoDialog`, `updateTechnician`.
- Invalidações de `['technical-tickets']` em `DetalheChamado` e `NovaInteracaoDialog`.
