

## Plano: Correção de 12 bugs de robustez no módulo CRM Carteiras

### Resumo das alterações

4 arquivos editados, 1 migration criada.

---

### 1. `FinalizarVisitaModal.tsx` — Bugs 1A, 2B, 4A, 7A, 7B, 7C

**Erros silenciosos + rollback + timeout + idempotência de snapshots**

- Envolver update da visita com `withTimeout` (12s)
- Capturar erro do fetch de produtos: `if (productsError) throw productsError`
- Usar `upsert` com `onConflict: 'visit_id,client_product_id'` (constraint já existe no DB) para snapshots, capturar erro
- Se snapshot falhar → rollback: reverter visita para `em_andamento` com checkout nulo
- Adicionar invalidações no `onSuccess`: `['crm-visitas']`, `['crm-carteira-visits']`, `['crm-carteira']`, `['crm-visit', visitId]`

### 2. `CrmVisitaExecucao.tsx` — Bugs 1B, 2A, 4A, 5C, 7A, 7D

**checkinMutation:**
- Envolver update com `withTimeout`
- Capturar erro do fetch de rules: `if (rulesError) throw rulesError`
- Capturar erro do insert de checklists: `if (checklistError)` → rollback (reverter visita para `planejada`)
- Para idempotência de checklists: não existe unique constraint em `crm_visit_checklists(visit_id, checklist_template_id)` → criar migration para adicionar. Após isso, usar `upsert` com `onConflict: 'visit_id,checklist_template_id'` e `ignoreDuplicates()`

**cancelMutation (Bug 5C):**
- Adicionar no `onSuccess`: `queryClient.invalidateQueries` para `['crm-visitas']`, `['crm-carteira-visits']`, `['crm-carteira']`, `['crm-visit', id]`

### 3. `CriarAcaoModal.tsx` — Bug 5A

- Substituir `invalidateQueries({ queryKey: ['crm-'] })` (no-op) por:
  - `['crm-360-actions', clientId]`
  - `['crm-actions-flat']`
  - `['crm-carteira-actions']`
  - `['crm-carteira']`
- Manter `['crm-360-actions']` já existente

### 4. `AtualizarNegociacaoModal.tsx` — Bug 5B

- Substituir `['crm-']` e `['crm-360']` (ambos no-ops) por:
  - `['crm-360-products']`
  - `['crm-carteira-products']`
  - `['crm-pipeline']`
  - `['crm-carteira']`

### 5. Migration — Unique constraint para idempotência de checklists

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_visit_checklists 
  ON public.crm_visit_checklists(visit_id, checklist_template_id);
```

### Arquivos alterados
- `src/components/crm/FinalizarVisitaModal.tsx`
- `src/pages/crm/CrmVisitaExecucao.tsx`
- `src/components/crm/CriarAcaoModal.tsx`
- `src/components/crm/AtualizarNegociacaoModal.tsx`
- Nova migration SQL (unique constraint)

### O que NÃO muda
- Nenhuma lógica de negócio, layout ou estilos
- Campos enviados ao banco permanecem idênticos
- Fluxo do usuário inalterado

