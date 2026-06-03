## Problema

Em `src/pages/preventivas/MinhasRotas.tsx`, o render quebra com `RangeError: Invalid time value` em `renderCorrectiveCard` (linha 663). Visitas corretivas sem `planned_start_date` chegam com `scheduled_date = ''`, e `format(parseISO(''), ...)` lança exceção, derrubando a árvore e deixando a tela em branco.

## Correção

Em `MinhasRotas.tsx`, proteger todas as chamadas `format(parseISO(...))` contra strings vazias/inválidas:

1. `renderCorrectiveCard` — `visit.scheduled_date` (linha ~663): só formatar se existir e for válido; caso contrário exibir `'Sem data'`.
2. `renderCorrectiveCard` — `visit.created_at` (linha ~645): idem.
3. `renderPreventiveCard` — `route.start_date` / `route.end_date` (linha ~559) e `route.created_at` (linha ~549): idem.
4. No `filteredRoutes` (filtro de data), tratar `scheduled_date`/`start_date` vazios sem chamar `parseISO` direto, para não disparar erro no filtro "hoje"/"semana".

Implementar um helper local `safeFormat(value, pattern, fallback)` que retorna `fallback` quando `value` é falsy ou a data parseada é inválida (`isNaN(date.getTime())`).

Nenhuma outra lógica é alterada.
