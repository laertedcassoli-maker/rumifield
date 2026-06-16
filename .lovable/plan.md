### Escopo
Alterar apenas o helper `calculateDuration` e `formatDuration` em `src/pages/chamados/Index.tsx` para exibir o tempo de vida do chamado no formato solicitado.

### Mudanças

1. **Helper `calculateDuration`**
   - Trocar de `differenceInHours` para `differenceInSeconds` (do `date-fns`).
   - Retornar o total de segundos entre as duas datas.

2. **Helper `formatDuration`**
   - Receber segundos em vez de horas.
   - Lógica hierárquica:
     - `>= 86400 seg` → exibir dias + horas restantes + minutos (ex: "2d 5h 30m")
     - `>= 3600 seg` e `< 86400` → exibir horas + minutos + segundos (ex: "5h 30m 15s")
     - `>= 60 seg` e `< 3600` → exibir minutos + segundos (ex: "30m 15s")
     - `< 60 seg` → exibir segundos (ex: "15s")
   - Se for exatamente 0 segundos, exibir "Agora".

3. **Tabela (coluna Duração)**
   - Ajustar a chamada inline no `TableCell` para passar segundos ao invés de horas.
   - Preservar as regras de cor (warning/destructive) baseadas no tempo decorrido para chamados não resolvidos. Ajustar os thresholds para segundos equivalentes (48h → 172800s; 168h → 604800s).

### Fora de escopo
- Não alterar o badge de duração na página de detalhe do chamado (`DetalheChamado.tsx`), pois o pedido se refere à "coluna" da listagem.
- Não alterar nenhuma outra lógica de filtros, paginação ou layout.