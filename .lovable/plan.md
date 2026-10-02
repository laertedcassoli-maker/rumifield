# Cancelar chamado também cancela as visitas em aberto

## O que muda para o usuário
- Ao cancelar um chamado, as visitas dele que estão "Em elaboração", "Planejada" ou "Em execução" passam para "Cancelada", com a nota "[Cancelada em <data/hora>] Cancelada junto com o chamado." somada às observações internas.
- Se alguma dessas visitas contou como preventiva, a preventiva também fica cancelada (exceto se já estiver concluída ou cancelada).
- Visitas finalizadas ou já canceladas ficam como estão.
- O diálogo "Cancelar chamado?" (lista de chamados e detalhe do chamado) mostra "N visita(s) em aberto também serão canceladas." quando houver pelo menos uma.
- Tudo acontece de uma vez: se o cancelamento das visitas falhar, o chamado não é cancelado.

## Detalhes técnicos
1. Antes de escrever a migração: conferir colunas de ticket_visits (ticket_id, status, internal_notes), corrective_maintenance (visit_id, preventive_maintenance_id), preventive_maintenance (status, notes) e as policies existentes.
2. Migração:
   - Função `public.cascade_cancel_ticket_visits()` SECURITY DEFINER, search_path=public; REVOKE EXECUTE de PUBLIC/anon.
   - Coleta os ids das visitas do chamado com status em ('em_elaboracao','planejada','em_execucao'); atualiza para 'cancelada' e concatena a nota em internal_notes (com `\n\n` quando já houver texto); data em horário de São Paulo, formato dd/mm/aaaa hh:mm.
   - Cancela preventive_maintenance ligadas via corrective_maintenance.visit_id dessas visitas, com status not in ('concluida','cancelada'), notes = 'Cancelada junto com a visita corretiva: Cancelada junto com o chamado'.
   - Trigger `AFTER UPDATE OF status ON technical_tickets FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado')`.
   - Sem mudanças em RLS, constraint ou regra de exclusão. A permissão continua garantida pela policy de UPDATE do chamado (can_cancel_corretiva).
3. Frontend (src/pages/chamados/Index.tsx e DetalheChamado.tsx): ao abrir o diálogo, consulta de contagem (`head: true, count: 'exact'`) em ticket_visits com o status em aberto; texto exibido só se N > 0.
4. Após cancelar: invalidar também `['ticket-visits', id]`, `['ticket-detail', id]` e as queries de preventivas, além das já invalidadas.
5. cancelCorrectiveVisit e a regra de exclusão não são alterados. Typecheck ao final; nada publicado.
