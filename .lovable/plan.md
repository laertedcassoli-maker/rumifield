# Ajuste: Permitir peças com estoque 0 nos pedidos

## Contexto
Atualmente, peças cadastradas no catálogo com `quantidade_estoque = 0` não podem ser adicionadas aos pedidos. A regra deve ser ajustada para que apenas o status `ativo` da peça determine se ela pode ser incluída, independentemente do saldo em estoque.

## Escopo
Aplicar a mudança em todos os fluxos que criam ou editam pedidos de peças:
- Solicitação de peças principal (`/pedidos`)
- Solicitação vinculada a chamados técnicos
- Solicitação vinculada a visitas corretivas/preventivas
- Edição de pedidos já solicitados

## Análise Técnica

A coluna `quantidade_estoque` existe na tabela `pecas`, mas a query principal de catálogo já busca apenas por `.eq('ativo', true)`, sem filtrar estoque. A validação que "bloqueia" pode estar em:

1. **Filtro implícito ou condicional no frontend** — algum componente pode estar ocultando ou desabilitando peças com `quantidade_estoque === 0` na lista de seleção.
2. **Regra de negócio no backend** — trigger, check constraint, ou edge function que valida estoque no momento do INSERT em `pedido_itens` (nenhuma foi encontrada nas tabelas relevantes, mas será re-auditada).
3. **Processo externo de inativação** — peças com estoque 0 podem estar sendo desativadas manualmente ou por outro job, fazendo com que desapareçam do filtro `ativo = true`.

## Passos de Implementação

### 1. Auditoria completa dos fluxos de pedido
- Revisar **todos** os componentes que carregam a lista de peças (`pecas`) para confirmar que não há filtro por `quantidade_estoque` ou desabilitação visual baseada em estoque.
- Componentes a verificar:
  - `src/pages/Pedidos.tsx` (criação/edição)
  - `src/components/pedidos/EditarPedidoSolicitado.tsx`
  - `src/components/chamados/TicketPartsRequestPanel.tsx`
  - `src/pages/preventivas/AtendimentoPreventivo.tsx`
  - `src/components/preventivas/ConsumedPartsBlock.tsx`
  - `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

### 2. Remover validações de estoque no frontend
- Caso exista qualquer lógica que esconda, desabilite, ou exiba mensagem de erro para peças com `quantidade_estoque <= 0`, remover essa lógica.
- Garantir que a exibição da peça na lista dependa unicamente de `ativo = true`.

### 3. Verificar backend
- Confirmar que não existem triggers, constraints, ou functions que levantem erro ao inserir `pedido_itens` quando a peça referenciada tem `quantidade_estoque = 0`.
- Se existirem, removê-las ou ajustá-las.

### 4. Ajustar sync de peças (se necessário)
- Verificar a edge function `sync-omie-pecas` para garantir que ela **não** desative peças automaticamente quando o estoque vai para 0 (atualmente ela não faz isso, mas será confirmado).

### 5. Testes
- Criar um pedido com peça de estoque 0.
- Editar pedido existente adicionando peça de estoque 0.
- Testar via chamado técnico e visita corretiva/preventiva.

## Notas
- O estoque é informativo para logística/faturamento, mas não deve ser gate de inclusão no pedido.
- A regra final: uma peça pode ser pedida se `ativo = true`; `quantidade_estoque` é apenas leitura informativa.
