

## Plano — Fase 2: rollbacks, idempotência e captura de erros (Chamados)

Apenas Fase 2. Sem mudar layout, RLS ou RPCs. Mantém campos enviados nas mutations.

### 2A — `NovaVisitaDiretaDialog.tsx`
Já implementado em iteração anterior (try/catch + rollback do ticket via FK cascade). **Verificação apenas:** garantir que `onSuccess` invalida `technical-tickets`, `my-corrective-visits`, `ticket-visits` e `ticket-timeline` (hoje invalida só os 2 primeiros). Adicionar as 2 invalidações faltantes.

### 2B — `NovoChamado.tsx`
Já refatorado (linhas 204-228 com try/catch + rollback). **Sem mudança.**

### 2C — `DetalheChamado.tsx` — `updateTags`
Substituir o padrão atual (snapshot + delete-all + insert + restore manual) pelo padrão diff:
1. Buscar `currentLinks` em `ticket_tag_links`.
2. Calcular `toAdd = tagIds \ currentIds` e `toRemove = currentIds \ tagIds`.
3. Insert de `toAdd` (se houver) com check de erro.
4. Delete de `toRemove` via `.in('tag_id', toRemove)` com check de erro.

Vantagem: nenhuma janela onde o ticket fica sem tags. Em caso de falha parcial, o estado intermediário permanece consistente (tags antigas preservadas).

### 2D — `ExecucaoVisitaCorretiva.tsx` — `completeMutation` (refator amplo)
Manter os blocos existentes mas:

1. **Idempotência preservada**: manter checagem inicial `currentVisit.status === 'finalizada' && checkout_at` → return early.
2. **Update visita** primeiro (já é o caso). Se falhar, throw (já está).
3. Envolver TODO o restante num `try { ... } catch (err) { rollback visit → 'em_execucao'; throw err }`.
4. **`corrective_maintenance`** (linhas 348-364): trocar `crypto.randomUUID()` cego por leitura prévia do `public_token` atual; só gerar UUID novo se nulo. **Capturar erro** (`if (cmError) throw cmError`) em vez de console.error.
5. **Pedidos `envio_fisico` e `apenas_nf`** (linhas 366-480): trocar `try/catch` silencioso por checagem de erro em CADA insert (`pedidos`, `pedido_itens`, `ticket_parts_requests`). Qualquer falha lança e dispara rollback.
6. **`workshop_items`** (linhas 483-519): substituir loop com select + insert por `upsert(workshopRows, { onConflict: 'unique_code', ignoreDuplicates: true })` em bulk. Capturar erro.
7. **Timeline `visit_completed`** (linhas 530-539): capturar erro (`if (tlError) throw tlError`).
8. **Resolução do ticket quando `result === 'resolvido'`** (linhas 542-567): capturar erro do update e do timeline.
9. **Rollback no catch**: `update ticket_visits set status='em_execucao', checkout_at=null, checkout_lat=null, checkout_lon=null, result=null where id=visitId`. Best-effort com `console.error` se rollback falhar; `throw err` original.

### 2E — `ExecucaoVisitaCorretiva.tsx` — `checkinMutation`
1. **Mover `setIsCheckingIn(true)`** para fora do `mutationFn` — colocar no handler do botão (antes do `mutate()`). Adicionar `onSettled: () => setIsCheckingIn(false)` na config da mutation. Remover os `setIsCheckingIn(false)` duplicados de `onSuccess` e `onError`.
2. **Timeline (linhas 246-255)**: trocar `try/catch` silencioso por `if (tlError) throw tlError`.
3. **PM creation (linhas 215-243)**: tornar bloqueante. Trocar o `try/catch` silencioso por checagem explícita de erro em ambos inserts (`preventive_maintenance` e fetch de existente). Se falhar, `throw`. Adicionar update bloqueante de `ticket_visits.preventive_maintenance_id` (atualmente o vínculo é feito via convenção de `notes ilike '%CORR-VISIT-...%'` — manter, pois `ticket_visits` não tem essa coluna; o vínculo já funciona pelo padrão de notes).

> Nota: a tabela `ticket_visits` no schema atual não possui coluna `preventive_maintenance_id`. O briefing menciona esse update mas o vínculo real é feito via `notes ilike '%CORR-VISIT-{visitId}%'` no `preventive_maintenance`. Vou **manter o vínculo por notes** (consistente com o queryFn linhas 127-132) e NÃO criar uma coluna nova. O `setQueryData` em `onSuccess` já propaga `preventiveId` para o cache.

### 2F — `ExecucaoVisitaCorretiva.tsx` — `queryFn`
O `queryFn` atual (linhas 81-169) **só lê** `preventive_maintenance` (não insere). A criação já está no `checkinMutation`. **Nenhuma mudança no queryFn**.

### Arquivos afetados
- `src/components/chamados/NovaVisitaDiretaDialog.tsx` — 2 invalidações extras no `onSuccess`.
- `src/pages/chamados/DetalheChamado.tsx` — refator de `updateTags` para padrão diff.
- `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` — refator de `checkinMutation` (PM bloqueante, timeline bloqueante, mover `setIsCheckingIn`) e `completeMutation` (rollback global, idempotência public_token, upsert workshop_items, captura de erros).

### Fora do escopo
- Fase 3 (NovaInteracaoDialog, FinalizarChamadoDialog, updateTechnician).
- Fase 4 (invalidações de `technical-tickets` em DetalheChamado/NovaInteracaoDialog).
- Mudanças em `NovoChamado` (já conforme briefing).

