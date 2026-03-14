
Objetivo: corrigir de forma definitiva o cenário offline em que marcar “Falha” não abre a lista de não conformidades no ChecklistExecution.

Diagnóstico (com base no código atual):
1) O sync global offline (`useOfflineSync.ts`, etapa `checklists`) cacheia checklist/blocos/itens, mas não cacheia os dados de referência de tratativas (`checklist_item_nonconformities` e `checklist_item_corrective_actions`).
2) No `ChecklistExecution`, a lista de tratativas depende desses dados de referência (`templateNonconformities`/`templateActions`). Se eles não estiverem no Dexie, `hasFailureDetails` fica falso e o bloco não renderiza no modo avião.
3) O render ainda usa `item.status` diretamente em partes críticas (`hasFailureDetails`, `needsTreatment`), o que pode gerar inconsistência visual em ciclos rápidos de status.

Plano de implementação:
1) Fortalecer o pré-cache offline de tratativas no sync global
- Arquivo: `src/hooks/useOfflineSync.ts` (case `"checklists"`).
- Após buscar os checklists do lote, coletar todos os `template_item_id` dos itens.
- Buscar em lote:
  - `checklist_item_corrective_actions` (ativos)
  - `checklist_item_nonconformities` (ativos)
- Persistir no Dexie com:
  - `offlineChecklistDb.cacheTemplateActions(...)`
  - `offlineChecklistDb.cacheTemplateNonconformities(...)`
- Fazer em chunks para evitar query muito grande.

2) Ajustar o cálculo visual no item para status efetivo
- Arquivo: `src/components/preventivas/ChecklistExecution.tsx`.
- No map de itens, criar/reusar `effectiveStatus = optimisticStatuses[item.id] ?? item.status`.
- Usar `effectiveStatus` em:
  - `hasFailureDetails`
  - `needsTreatment`
  - classes condicionais de item em falha
- Isso remove atraso/percepção inconsistente ao ciclar status.

3) Garantir autoabertura robusta quando virar Falha
- Manter a abertura imediata no `onChange` (já existe), e complementar com efeito defensivo:
  - quando item estiver em `effectiveStatus === 'N'` e tiver detalhes disponíveis, garantir item em `expandedItems`.
- Evita estado “marcou Falha mas não abriu” em casos de re-render/latência de fallback.

4) Recarregar fallback offline das tratativas quando checklist estiver pronto
- Ainda em `ChecklistExecution`, aproveitar `refetchOffline` das queries de tratativas (`useOfflineQuery`) para forçar leitura local quando:
  - checklist carregar no modo offline
  - conjunto de `templateItemIds` mudar
- Resolve timing de montagem onde fallback poderia ter rodado cedo demais.

5) Feedback de falha de cache (opcional, mas recomendado)
- Se status = `N` e não houver opções de tratativa em offline, mostrar aviso curto no card (“Tratativas deste item não estão no cache offline. Sincronize online.”).
- Evita comportamento “silencioso” para o técnico.

Detalhes técnicos (resumo objetivo):
- Sem migração de banco e sem mudança de RLS.
- Mudanças focadas em frontend + Dexie cache local.
- Arquivos-alvo:
  - `src/hooks/useOfflineSync.ts`
  - `src/components/preventivas/ChecklistExecution.tsx`
- Critério de aceite:
  1) Sincronizar online
  2) Ativar modo avião
  3) Abrir checklist
  4) Marcar item em Falha
  5) Ver imediatamente bloco de não conformidades já expandido
  6) Ao trocar para OK/N/A, bloco some.
