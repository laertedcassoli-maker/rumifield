

## Correção de robustez — Módulo de Chamados (7 bugs)

**Nota:** Bug 7 (NovaVisitaDiretaDialog navigator.onLine) e Bug 2 parcial (rollback) já foram corrigidos na iteração anterior. Os itens abaixo cobrem o que resta.

### Novo arquivo: `src/lib/supabase-helpers.ts`
Criar helper `withTimeout<T>(promise, ms=10000)` usando `Promise.race` — reutilizável em todos os módulos.

### 1. `src/pages/chamados/NovoChamado.tsx` (Bug 1 + Bug 8)
- Salvar `ticket.id` após insert
- Envolver timeline + tags em try/catch com rollback (delete ticket) no catch antes de re-throw
- Aplicar `withTimeout` no insert principal

### 2. `src/components/chamados/NovaVisitaDialog.tsx` (Bug 2 + Bug 8)
- Capturar erro do `.update()` de status: `if (updateError) throw updateError`
- Capturar erro do insert timeline: `if (tlError) throw tlError`
- Rollback: se update/timeline falhar, deletar a visita criada
- Adicionar `queryClient.invalidateQueries({ queryKey: ['technical-tickets'] })` no onSuccess
- Aplicar `withTimeout` na criação da visita

### 3. `src/components/chamados/NovaInteracaoDialog.tsx` (Bug 3 + Bug 8)
- Capturar erro do `.update()` de status: `if (updateError) throw updateError`
- Adicionar `queryClient.invalidateQueries({ queryKey: ['technical-tickets'] })` no onSuccess
- Aplicar `withTimeout` no insert da timeline

### 4. `src/components/chamados/FinalizarChamadoDialog.tsx` (Bug 4 + Bug 8)
- Capturar erro do insert timeline: `if (tlError) throw tlError`
- Adicionar `queryClient.invalidateQueries({ queryKey: ['technical-tickets'] })` no onSuccess
- Aplicar `withTimeout` no update principal

### 5. `src/pages/chamados/DetalheChamado.tsx` (Bug 5 + Bug 6)
- **Tags (Bug 5):** Antes do DELETE, salvar snapshot das tags atuais. Se o INSERT falhar, restaurar tags anteriores antes de re-throw
- **Técnico (Bug 6):** Capturar erro do insert timeline com `console.error` (não bloqueia, mas registra)

### 6. `src/components/chamados/NovaVisitaDiretaDialog.tsx` (Bug 8 only)
- Aplicar `withTimeout` nas chamadas críticas (já tem rollback)
- Remover `navigator.onLine` check (timeout é proteção suficiente)

### Arquivos alterados
- `src/lib/supabase-helpers.ts` (novo)
- `src/pages/chamados/NovoChamado.tsx`
- `src/components/chamados/NovaVisitaDialog.tsx`
- `src/components/chamados/NovaInteracaoDialog.tsx`
- `src/components/chamados/FinalizarChamadoDialog.tsx`
- `src/pages/chamados/DetalheChamado.tsx`
- `src/components/chamados/NovaVisitaDiretaDialog.tsx`

