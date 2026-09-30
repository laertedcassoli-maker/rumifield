# Fase 2 — Cancelamento na Corretiva (chamados e visitas)

## O que muda para o usuário
- **Chamado "Aberto"**: botão "Excluir Chamado" continua igual (exclui de verdade).
- **Chamado em qualquer outro status**: o botão vira "Cancelar chamado", abre janela com "Motivo do cancelamento *" (obrigatório). O chamado fica "Cancelado" e o motivo aparece na linha do tempo.
- **Visita corretiva "Em elaboração"/"Planejada"**: "Excluir Visita" continua excluindo.
- **Visita em outro status**: vira "Cancelar visita" com justificativa obrigatória; fica "Cancelada".
- Se a visita cancelada tinha "contado como preventiva", essa preventiva também é cancelada com a mesma justificativa.
- Chamado/visita já cancelado: botão some.
- Relatórios de chamados: visita cancelada não conta mais como atendimento presencial nem na produtividade do técnico.

## Detalhes técnicos
1. `src/pages/chamados/DetalheChamado.tsx` e `src/pages/chamados/Index.tsx` (`deleteTicketMutation`):
   - `status === 'aberto'` → delete atual.
   - Senão → `update({status:'cancelado'}).select('id')` (timeout 12s, erro se 0 linhas) + insert em `ticket_timeline` (event_type `cancelamento`, `notes` = motivo). `technical_tickets` não tem coluna de observação própria (só `description`), por isso o motivo vai para a linha do tempo, sem mexer na descrição.
   - AlertDialog com título/texto condicional e Textarea obrigatório (botão fica clicável e mostra toast se vazio). Botão escondido se `cancelado`.
2. `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` (`deleteVisitMutation`, ~l.979) — única alteração nesse arquivo, pedida explicitamente:
   - `em_elaboracao`/`planejada` → delete atual.
   - Senão → `ticket_visits.update({status:'cancelada', internal_notes: notas + "[Cancelada em dd/mm/aaaa hh:mm] motivo"})`.
   - Cascata: busca `corrective_maintenance` com `visit_id` e `preventive_maintenance_id` preenchido; se houver, `preventive_maintenance.update({status:'cancelada', notes: justificativa})`. `corrective_maintenance` não é alterado.
   - Botão escondido se `cancelada`.
3. `src/lib/queries/chamadosGerencial.ts`: ao montar `visitsByTicket`, ignorar visitas `cancelada` (afeta `countRemotoVsVisita` e `produtividadePorTecnico`).
4. `useMinhasPendencias.ts` já usa listas explícitas (`VISIT_PENDING` sem cancelada; chamados idem) — sem mudança, só conferência.
5. Sem mudança de banco/RLS. Sem publicar. Typecheck ao final.
