# Tempo médio de vida útil do motor

## Objetivo
Substituir, dentro de **Dashboards > Gestão de OS > Saúde de Ativos / Motores**, a tabela “Últimas trocas de motor” por uma visão de **Tempo médio de vida útil do motor**.

## Implementação
- Manter intacta a tabela “Ativos com motor há mais tempo em uso”.
- Buscar o histórico completo de trocas necessário ao cálculo, em vez de limitar a consulta às 10 trocas mais recentes.
- Agrupar as trocas por ativo e ordená-las cronologicamente.
- Considerar somente ativos com pelo menos duas trocas registradas.
- Para ativos com três ou mais trocas, considerar todos os ciclos completos entre trocas consecutivas.
- Excluir da média o primeiro motor conhecido do ativo e o motor atualmente instalado, pois não possuem ciclo completo comprovado no sistema.
- Validar a continuidade do ciclo pelo código do motor instalado em uma troca e removido na troca seguinte; registros inconsistentes não entrarão nas médias.
- Calcular, para cada ciclo válido:
  - **Vida útil em horas:** horas de uso registradas quando o motor foi removido.
  - **Vida útil em dias:** diferença entre a data de instalação e a data da troca seguinte.
- Exibir no topo da nova seção:
  - média geral de vida útil em horas;
  - média geral de vida útil em dias;
  - quantidade de ciclos completos considerados.
- Exibir uma tabela de apoio por ativo com código do ativo, quantidade de ciclos completos, média em horas e média em dias.
- Mostrar um estado vazio claro quando ainda não houver ciclos completos suficientes.

## Escopo técnico
- Alterar apenas `src/components/oficina/SaudeAtivosMotores.tsx`.
- Reutilizar `workshop_items` e `motor_replacement_history`; nenhuma alteração no banco ou nas regras de gravação.
- A seção continuará independente dos filtros de período e atividade da Gestão de OS, seguindo o comportamento atual do bloco Saúde de Ativos / Motores.

## Validação
- Conferir ativos com exatamente duas trocas e com três ou mais trocas.
- Garantir que ativos com somente uma troca não participem dos cálculos.
- Conferir horas, dias, médias gerais e médias por ativo contra os registros de origem.
- Validar carregamento, estado vazio e apresentação em telas menores.
