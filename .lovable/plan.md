

## Ajuste nos pedidos automaticos ao finalizar visita preventiva

### Situacao atual
- Pecas com `stock_source = 'novo_pedido'` geram um pedido com `tipo_envio: 'apenas_nf'` (incorreto)
- Pecas com `stock_source = 'tecnico'` nao geram pedido nenhum (incompleto)

### O que sera feito

**1. Pecas "novo_pedido" -- corrigir para envio fisico**
- Alterar o `tipo_envio` de `'apenas_nf'` para `'envio_fisico'` no pedido gerado automaticamente
- Essas pecas precisam ser enviadas fisicamente ao tecnico, portanto o pedido deve refletir isso

**2. Pecas "tecnico" -- criar pedido apenas para NF**
- Adicionar um novo bloco apos o bloco de `novo_pedido` (apos linha 212)
- Buscar pecas consumidas com `stock_source = 'tecnico'`
- Criar um pedido separado com:
  - `origem: 'preventiva'`
  - `tipo_envio: 'apenas_nf'` (apenas emissao de nota fiscal, sem envio fisico)
  - `observacoes`: indicando que sao pecas do estoque do tecnico, apenas para faturamento
- Inserir os itens agrupados em `pedido_itens`

### Detalhes tecnicos

**Arquivo**: `src/pages/preventivas/AtendimentoPreventivo.tsx`

- Linha 193: alterar `tipo_envio: 'apenas_nf'` para `tipo_envio: 'envio_fisico'`
- Apos linha 212: inserir novo bloco que:
  1. Busca pecas com `stock_source = 'tecnico'` na tabela `preventive_part_consumption`
  2. Cria registro em `pedidos` com `tipo_envio: 'apenas_nf'` e observacao especifica
  3. Agrupa por `part_id` e insere em `pedido_itens`

### Resumo do comportamento final

| Fonte de estoque | Gera pedido? | Tipo envio | Objetivo |
|---|---|---|---|
| Tecnico | Sim | apenas_nf | Emissao de NF para regularizar consumo |
| Novo pedido | Sim | envio_fisico | Envio real de pecas ao tecnico |
| Fazenda | Nao | -- | Sem acao automatica |

