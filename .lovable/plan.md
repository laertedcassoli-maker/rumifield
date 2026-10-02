# Rastreio Omie: corrigir fallback, NFs inválidas e fila do lote

## Parte 1 — Fallback remessa → pedido de venda
Em `supabase/functions/buscar-rastreio-omie/index.ts`:
- O fallback para `ConsultarPedido` passa a rodar também quando o Omie responde "Registro não encontrado" (sem diferenciar acento/maiúscula), além de "não cadastrado".
- Se o pedido de venda também não for encontrado, a NF vira "não encontrada" com mensagem "Documento de origem não encontrado no Omie (remessa nem pedido de venda)", em vez de "erro".
- "Erro" fica só para falhas reais (autenticação, limite de consumo, HTTP, falha inesperada).

## Parte 2 — "NF em formato inválido" (valores reais no banco)
| Pedido | omie_nf_numero | omie_nf_numero_2 |
|---|---|---|
| SP-00000564 | `2.939` | vazio |
| SP-00000565 | `SENDO ENVIADO JUNTO COM AS 04 PISTOLAS.` | vazio |
| SP-00000656 | `Declaração de Conteúdo 1/10` | vazio |

Proposta:
- `2.939`: ponto como separador de milhar. Normalizar só o formato exato `1-3 dígitos` + grupos `.ddd` (ex.: `2.939` vira `2939`). Não há outra leitura possível desse formato.
- SP-00000565 e SP-00000656: não são NF (texto livre / declaração de conteúdo). Só relatar, sem tentar adivinhar. Esses casos passam a ser "sem NF válida" (contados como não encontrados), não "erro".
- Nenhuma regex com séries, hífens ou barras é adicionada.

## Parte 3 — Fila que avança a cada rodada
- Migração: coluna `pedidos.rastreio_ultima_tentativa_em` (timestamptz, nula). Confirmado que ainda não existe. Sem policies novas.
- No lote, cada pedido processado grava essa coluna (também em dryRun? Não: no dryRun nada é gravado, nem a tentativa).
- Seleção do lote: mesmos filtros e limite de 25, ordenados por `rastreio_ultima_tentativa_em ASC NULLS FIRST`, depois `omie_data_faturamento DESC`. Com isso, nunca tentados vêm primeiro e quem foi tentado há menos tempo (incluindo "sem rastreio" das últimas 3h) fica no fim da fila.
- Tipos do banco regenerados automaticamente.

## Não muda
Horário do agendamento (8h/13h/18h), limite de 25, desempate entre NFs, pedidos que já têm código, tela Rastreio Correios, regra de "códigos diferentes" (não grava).

## Validação
- Deploy da função e execução do lote em dryRun.
- Mostrar o resumo novo (preenchidos, sem rastreio, não encontrados, erros com mensagem) e conferir que os 9 pedidos com "Registro não encontrado" (SP-508, 510, 514, 515, 523, 525, 562, 647, 648) deixam de dar erro.
- Observação: como dryRun não grava a tentativa, o avanço da fila só aparece a partir das rodadas reais.
