
Objetivo: corrigir a ordenação em **Minhas Rotas** quando os cards parecem ter a mesma data de criação, mas ainda ficam fora da prioridade de status.

1) Diagnóstico provável (com base no código atual)
- Hoje a ordenação usa `created_at.slice(0, 10)` como chave primária de dia.
- Isso pega o **dia em UTC** da string, enquanto a data exibida no card (`format(parseISO(...), 'dd/MM/yyyy')`) está em horário local.
- Resultado: dois cards podem aparecer com a **mesma data visível** para você, mas terem chaves de dia diferentes na ordenação; por isso um card “não iniciado/planejada” pode cair entre cards “em execução”.

2) Ajuste de ordenação (somente em `src/pages/preventivas/MinhasRotas.tsx`)
- Manter a regra pedida:
  - Primária: data de criação decrescente
  - Secundária: prioridade de status
- Trocar a chave de dia para **dia local normalizado**:
  - `getCreatedDayKey(created_at)` usando `parseISO` + `format(..., 'yyyy-MM-dd')`
  - fallback seguro para `''` quando inválido/nulo
- Manter normalização de status de corretivas:
  - `em_andamento -> em_execucao`
  - `agendada -> planejada`
- Comparator final:
  1. `createdDay` local desc
  2. `STATUS_PRIORITY` asc (`em_elaboracao`, `em_execucao`, `planejada`, `finalizada`, `cancelada`)
  3. timestamp completo desc (`new Date(created_at).getTime()`)
  4. `id` asc (desempate determinístico)

3) Restrições que serão respeitadas
- Não tocar no bloco de filtros de período (`hoje`, `semana`, `todas`).
- Não alterar filtros de status/tipo/técnico.
- Manter exatamente o mapeamento offline das corretivas já existente.
- Não alterar layout dos cards nem exibição de “Criada em”.

4) Validação após ajuste
- Testar com cards de preventiva/corretiva exibindo a mesma data no card.
- Confirmar que nenhum “planejada/não iniciado” aparece entre dois “em execução”.
- Confirmar ordem esperada quando houver empate total (usa timestamp completo e id).
