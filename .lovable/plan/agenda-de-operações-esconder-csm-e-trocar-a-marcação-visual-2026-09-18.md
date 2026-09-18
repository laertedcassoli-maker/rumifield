# Agenda de Operações — esconder CSM e trocar a marcação visual de grupo

## Contexto atual (verificado)

- `src/hooks/useAgendaOperacoes.ts` (~linha 71-72): a fonte `installation_stages` gera evento para toda etapa com data, usando `technician_user_id ?? csm_user_id` como responsável — ou seja, etapas atribuídas só a um CSM aparecem hoje.
- `src/pages/AgendaOperacoes.tsx`:
  - `eventDidMount` (~linha 190-199): usa `borderStyle = 'dashed'` + `borderWidth = '2px'` para "Instalações Existentes"; "Novas Instalações" fica sólido.
  - Legenda (~linha 138-146): dois chips com borda sólida/tracejada.

## Tarefa 1 — Ocultar compromissos de CSM

Em `src/hooks/useAgendaOperacoes.ts`, na query `installation_stages`:

- Após buscar os dados, filtrar: manter apenas linhas com `technician_user_id` preenchido.
- Etapas só com `csm_user_id` (sem técnico) não viram evento.
- Em `fetchProfilesMap`, os ids passados podem continuar como estão (após o filtro, `csm_user_id` ainda pode existir junto ao técnico, e não atrapalha).

## Tarefa 2 — Distinção visual por cantos (quadrado vs arredondado)

Em `src/pages/AgendaOperacoes.tsx`, `eventDidMount`:

- Remover a lógica de `borderStyle`/`borderWidth`.
- `grupo === 'novas_instalacoes'` → `info.el.style.borderRadius = '0'` (cantos quadrados).
- `grupo === 'instalacoes_existentes'` → nada (mantém o border-radius padrão do FullCalendar, arredondado como hoje).

Legenda (chips de grupo):

- "Novas Instalações": chip quadrado (`rounded-none`), mantendo borda sólida.
- "Instalações Existentes": chip arredondado (`rounded-full` ou `rounded-sm`), mantendo borda sólida — a borda tracejada some dos dois chips.

## Não alterar

- Cores por técnico, filtro por técnico, filtro por grupo.
- Fontes de `ticket_visits` e `preventive_route_items`.
- Qualquer outra parte da tela ou do hook.

## Validação

- Typecheck (`bunx tsgo --noEmit`) e build.
- Playwright no preview: confirmar que eventos de Novas Instalações têm `border-radius: 0` no elemento, Instalações Existentes mantêm cantos arredondados, a legenda mostra os chips novos, e nenhum evento só-CSM aparece (conferindo contra uma etapa que tenha apenas `csm_user_id`).
