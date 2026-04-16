
Phase 3 is straightforward — apenas capturar erros silenciados. Já vi `NovaInteracaoDialog.tsx` e `FinalizarChamadoDialog.tsx` no contexto. Preciso confirmar apenas o estado atual de `updateTechnician` em `DetalheChamado.tsx`.

Observações do contexto já visível:
- `NovaInteracaoDialog.tsx`: o segundo update (`.update(updatePayload)`) já tem `if (updateError) throw updateError`. **Já está conforme.** Só vou confirmar no arquivo final.
- `FinalizarChamadoDialog.tsx`: já tem `if (tlError) throw tlError`. Falta apenas a invalidação `['technical-tickets']` no `onSuccess` (já invalida `ticket-detail`, `ticket-timeline` e `technical-tickets` — verificando: sim, já invalida `technical-tickets`). **Verificar se realmente falta algo.**

Releitura cuidadosa:
- `FinalizarChamadoDialog` linhas 64-67: `queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });` → **já presente**.
- `NovaInteracaoDialog` linhas 73-77: `if (updateError) throw updateError;` → **já presente**.

Então apenas 3C é trabalho efetivo. Mas para ser fiel ao briefing, vou revisar os 3 arquivos e garantir que todos os erros estão capturados.

## Plano — Fase 3: capturar erros silenciados

### 3A — `NovaInteracaoDialog.tsx`
Já implementado (`if (updateError) throw updateError` linha 77). **Verificação apenas, sem mudanças.**

### 3B — `FinalizarChamadoDialog.tsx`
Já implementado (`if (tlError) throw tlError` linha 49 e `invalidateQueries(['technical-tickets'])` no `onSuccess` linha 67). **Verificação apenas, sem mudanças.**

### 3C — `DetalheChamado.tsx` — `updateTechnician`
Trocar o padrão atual (provável `try/catch` silencioso ou ausência de check) por:
```ts
const { error: tlError } = await supabase
  .from('ticket_timeline')
  .insert({
    ticket_id: id,
    user_id: user!.id,
    event_type: 'technician_assigned',
    event_description: technicianId ? 'Técnico atribuído' : 'Técnico removido',
  });
if (tlError) throw tlError;
```
Manter o restante da mutation (update do ticket, invalidações no `onSuccess`) intacto.

### Arquivos afetados
- `src/pages/chamados/DetalheChamado.tsx` — captura de erro do timeline em `updateTechnician`.

### Fora do escopo
- Fase 4 (invalidações faltantes em DetalheChamado/NovaInteracaoDialog).
