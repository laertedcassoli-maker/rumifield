# Ajuste na extração de NF do relatório dos Correios

## Objetivo
Corrigir como a rotina de rastreio identifica o número da nota fiscal no relatório dos Correios, aproveitando a ordem fixa das colunas: a NF vem sempre na célula imediatamente depois do código de rastreio.

## Mudança
Em `supabase/functions/sync-correios-rastreio/index.ts`, função `extrairPares`:

- Remover a lógica atual ("último número puro antes do rastreio, com fallback para o primeiro número puro da linha"), que erra em linhas com valores sem casas decimais (ex.: pesos como 550/980).
- Nova regra: `cells[idxRastreio + 1]` (célula imediatamente seguinte ao código de rastreio) é a NF, validada com `/^\d{1,12}$/`; zeros à esquerda removidos.
- Linha ignorada se a célula seguinte não existir ou não for numérica.

## Validação
1. Rodar a função sobre o arquivo de exemplo real da pasta do Drive.
2. Confirmar que as 17 remessas extraem a NF correta (inclusive as linhas com 550/980 que hoje falham).
3. Confirmar idempotência: reprocessar o mesmo arquivo não altera nada.

## Fora de escopo
Sem alterações no restante da função, no cron, em Pedidos.tsx ou em qualquer outra tela.
