# Agenda: período da instalação e datas reais de conclusão

## O que muda na Agenda
- **Instalação com início e fim:** a etapa aparece como uma faixa que cobre todos os dias do período. Vale para todos os técnicos.
- **Corretiva concluída:** aparece do dia do check-in até o dia do check-out.
- **Pré Instalação / Instalação concluída:** aparece em um único dia, o da aprovação.
- **Preventiva concluída:** aparece no dia real de conclusão.
- **Itens não concluídos:** continuam na data planejada, como hoje. O mesmo vale quando falta a data real: o item fica na data planejada.

## Situação atual dos dados
- 38 corretivas finalizadas, todas com check-in e check-out, e 61 preventivas com data de conclusão. Elas mudam de lugar na agenda assim que o ajuste entrar.
- Hoje nenhuma etapa de instalação tem data fim nem está concluída. Por isso, essas duas partes só vão aparecer quando houver etapas nessa situação.

## Detalhes técnicos
- `useAgendaOperacoes.ts`
  - Adicionar `dataFim?: string | null` em `AgendaEvento`.
  - **Instalações:** o select passa a trazer `planned_date_end` e `approved_at`.
    - Se `status === 'concluido'` e existe `approved_at`: `data` = dia de `approved_at` e `dataFim` = null.
    - Caso contrário: `data` = `planned_date` e `dataFim` = `planned_date_end`.
  - **Visitas:** o select passa a trazer `checkin_at` e `checkout_at`.
    - Se `status === 'finalizada'` e existem as duas: `data` = dia do check-in e `dataFim` = dia do check-out, apenas quando for um dia diferente.
  - **Preventivas:** uma consulta extra em `preventive_maintenance` (`route_id, client_id, completed_date`) com `.in('route_id', routeIds)`, montando um mapa pela chave `route_id|client_id`.
    - Se existir `completed_date`, ele substitui `planned_date`.
  - **Timestamps viram data local:** usar um helper `diaLocal(ts)` com `toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`, para o evento não cair no dia errado.
- `AgendaOperacoes.tsx`: no mapeamento de `doTrabalho`, usar `...(e.dataFim ? { end: endExclusivo(e.dataFim) } : {})`.
- Sem mudanças no banco, nos filtros, nas cores ou nas ausências.

## Validação
- Checagem de tipos.
- Playwright na Agenda: confirmar uma corretiva finalizada no dia do check-in e uma preventiva concluída no dia do `completed_date`, conferindo contra o banco.
