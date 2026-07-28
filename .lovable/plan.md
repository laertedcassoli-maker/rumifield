## Diagnóstico (confirmado no banco)

Existem hoje **2 registros em `work_order_time_entries` com `status = 'running'`** apontando para a OS **OS-2026-00037**, que já está com status `concluido`. Um deles é do usuário do Phelipe. Como a validação atual só pergunta "existe algum timer running deste usuário?", ela bloqueia qualquer novo início de cronômetro — mesmo sem nenhuma OS em execução na tela.

## O que fazer

Arquivo único: `src/components/oficina/DetalheOSDialog.tsx`, dentro de `startTimerMutation` (bloco atual nas linhas 551-561).

Nova lógica:

1. Buscar os timers `running` do usuário trazendo junto a OS relacionada (`work_order_id`, `started_at`, e o `status`/`code` da OS via join).
2. Separar em dois grupos:
   - **Órfãos**: OS inexistente, ou com status diferente de `em_manutencao`/`aguardando` (ex.: `concluido`).
   - **Ativos**: OS ainda existente e em `em_manutencao` ou `aguardando`.
3. Para cada órfão, fazer auto-cleanup: `ended_at = now`, `duration_seconds = now - started_at` (em segundos, mínimo 0), `status = 'finished'`.
4. Se sobrar algum timer **ativo**, bloquear com mensagem contendo o código da OS: `Você já tem um cronômetro ativo na OS OS-2026-00037`.
5. Se só havia órfãos, seguir normalmente com o início do novo cronômetro.

Também trocar `.maybeSingle()` por listagem (`select` sem single), já que hoje múltiplos registros running fariam o `maybeSingle` retornar erro/null silenciosamente.

## Detalhes técnicos

- Consulta: `work_order_time_entries` com `select('id, work_order_id, started_at, work_orders(code, status)')`, filtrando `user_id` e `status='running'`.
- O update de limpeza respeita o timeout padrão de mutações do projeto (`withTimeout`) e valida o retorno com `.select('id')` para detectar bloqueio silencioso de RLS.
- Em caso de falha no cleanup, o erro é propagado e o `optimisticTimeEntry` é revertido pelo `onError` já existente.

## Fora do escopo

- Nenhuma alteração de schema, RLS ou outros arquivos.
- Os 2 registros órfãos atuais serão limpos automaticamente na próxima tentativa de iniciar cronômetro; se preferir, posso também rodar uma limpeza pontual desses registros no banco — me avise.
