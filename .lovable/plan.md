# Sincronização automática de peças (Omie)

## Situação atual

A sincronização de peças do Omie já é automática, mas roda apenas **3 vezes por semana** (segunda, quarta e sexta, às 12h). Por isso, quando o usuário cadastra uma peça nova no Omie, ela pode demorar **até 2 dias** para aparecer no sistema.

A sincronização manual (botão "Sincronizar com Omie" na tela de Peças) continua funcionando normalmente.

## Mudança proposta

Reagendar o cron job `sync-omie-pecas-auto` para rodar **a cada 1 hora**, todos os dias. Assim, qualquer peça nova cadastrada no Omie aparece no sistema em no máximo ~1 hora, sem ação manual.

A função `sync-omie-pecas` já é idempotente (faz upsert por `omie_codigo`, reativa peças que voltaram, desativa as que sumiram), então rodar com frequência alta é seguro.

## Detalhes técnicos

- Migration alterando o schedule do job pg_cron:
  - de `0 12 * * 1,3,5` (3x/semana ao meio-dia)
  - para `0 * * * *` (a cada hora cheia)
- Usar `cron.unschedule('sync-omie-pecas-auto')` + `cron.schedule(...)` com a mesma chamada `net.http_post` já existente.
- Nenhuma mudança no edge function nem no frontend.

## Observações

- Caso prefira intervalo diferente (ex: a cada 30 min, a cada 2h, ou apenas em horário comercial), é só ajustar o cron expression.
- O botão de sincronização manual continua disponível para casos urgentes.
