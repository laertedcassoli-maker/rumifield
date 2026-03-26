

## Corrigir bugs de Corretivas e Chamados (Bugs #1-#5)

### Arquivos alterados
- `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
- `src/components/chamados/NovaVisitaDiretaDialog.tsx`

---

### Bug #1 + #5 — completeMutation idempotente e resiliente a falha parcial
**Arquivo:** `ExecucaoVisitaCorretiva.tsx` (linhas 233-476)

No início da `mutationFn`:
1. Buscar estado atual da visita (`status`, `checkout_at`)
2. Se já `finalizada` com `checkout_at`, retornar early (já completou)
3. Se não finalizada, prosseguir normalmente

Operações não-críticas envoltas em try/catch individual (não relançam):
- `corrective_maintenance` update (linhas 263-279)
- Criação de pedidos + pedido_itens (linhas 282-367)
- Criação de workshop_items (linhas 369-402)
- Inserts em `ticket_timeline` (linhas 413-418, 434-439)
- Update de `technical_tickets` para resolvido (linhas 421-431) — este permanece crítico mas com try/catch que loga e não trava

Apenas o update principal de `ticket_visits` (linhas 249-260) permanece como operação crítica que relança erro.

### Bug #2 — NovaVisitaDiretaDialog com rollback
**Arquivo:** `NovaVisitaDiretaDialog.tsx` (linhas 99-167)

1. Declarar `let createdTicketId: string | null = null` antes do try
2. Após insert do ticket: `createdTicketId = ticket.id`
3. Envolver insert de `ticket_timeline` em try/catch independente (não bloqueia)
4. No catch principal: se `createdTicketId` existe, deletar o ticket (cascade deleta visit também via FK)

### Bug #3 — Checkin com timeout e verificação RLS
**Arquivo:** `ExecucaoVisitaCorretiva.tsx` (linhas 178-230)

1. Adicionar verificação `navigator.onLine` no início
2. Usar `Promise.race` com timeout de 15s no update de checkin
3. Usar `.select('id').single()` para verificar que a linha foi afetada
4. Se `!data`, lançar erro explícito
5. Envolver `ticket_timeline` do checkin em try/catch independente

### Bug #4 — isOnline reativo
**Arquivo:** `ExecucaoVisitaCorretiva.tsx`

Adicionar estado reativo `isOnline` com `useState` + `useEffect` (online/offline listeners). Usar nas mutations para dar feedback imediato ao invés de deixar o request travar.

Não necessário em `NovaVisitaDiretaDialog` pois é um dialog modal que já depende de conexão para carregar clientes — mas adicionar check `navigator.onLine` no início da mutation.

