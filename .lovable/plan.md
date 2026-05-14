## Objetivo
Estender as regras da PRD00605 ↔ PRD00639 (vínculo automático ×3) e do **Modelo de Solenoide (2x/3x)** para todas as telas onde uma peça pode ser solicitada e para todas as visualizações de detalhes de pedido.

## Telas afetadas

### Solicitação de peças (entrada)
1. **`src/components/chamados/TicketPartsRequestPanel.tsx`** — solicitação manual a partir de um chamado.
2. **`src/components/pedidos/EditarPedidoSolicitado.tsx`** — edição de rascunho/solicitação existente.
3. **`src/pages/preventivas/AtendimentoPreventivo.tsx`** — checkout de visita preventiva (cria pedidos automáticos).
4. **`src/pages/chamados/ExecucaoVisitaCorretiva.tsx`** — checkout de visita corretiva (cria pedidos automáticos).

### Visualização de detalhes do pedido
5. **`src/pages/chamados/DetalheChamado.tsx`** — bloco de pedidos vinculados ao chamado.
6. **`src/components/pedidos/EditarPedidoSolicitado.tsx`** — também precisa exibir/editar o modelo.
7. *(Já feito: `src/pages/Pedidos.tsx` viewingPedido.)*

## Comportamento padrão (replicar em todas as entradas)

- **Auto-vínculo PRD00605 → PRD00639 ×3:** ao adicionar/alterar/remover PRD00605, recalcular PRD00639 = qty(PRD00605) × 3. Já garantido no banco pelo trigger `auto_link_pedido_pecas`, mas refletir visualmente no carrinho de cada tela.
- **Bloqueio de edição manual da PRD00639** quando vinculada (badge "Vinculado ao PRD00605 (×3)", botões de qty/remover desabilitados).
- **Seletor de Modelo (2x / 3x)** obrigatório quando houver PRD00605 entre os itens; persistido na coluna `pedidos.solenoide_modelo` no insert/update.
  - No `TicketPartsRequestPanel`, adicionar `solenoide_modelo` no INSERT do `pedidos`.
  - No `EditarPedidoSolicitado`, exibir/editar e salvar `solenoide_modelo`.
  - No checkout de **AtendimentoPreventivo** e **ExecucaoVisitaCorretiva**, antes de criar o pedido, abrir um passo/diálogo extra perguntando o modelo quando PRD00605 estiver entre as peças consumidas; bloquear o checkout até a escolha; gravar `solenoide_modelo` no INSERT do pedido gerado.
- **Validação:** botão de salvar/finalizar continua clicável; em caso de modelo ausente, mostrar toast explícito (padrão UX do projeto).

## Visualização do modelo

Renderizar bloco "Modelo do Solenoide" (badge `2x`/`3x`) sempre que `pedido.solenoide_modelo` estiver preenchido em:
- `DetalheChamado.tsx` no card de cada pedido vinculado (após o status, antes da lista de itens).
- `EditarPedidoSolicitado.tsx` no topo do rascunho (com o seletor 2x/3x quando PRD00605 estiver presente).
- `Pedidos.tsx` viewingPedido (já implementado, manter).

## Backend

Nenhuma migração nova necessária:
- Coluna `pedidos.solenoide_modelo` já existe.
- Trigger `auto_link_pedido_pecas` já cobre INSERT/UPDATE/DELETE em qualquer fluxo.

## Resultado
Independente de onde o usuário cria/edita um pedido (chamado, preventiva, corretiva, edição manual), o vínculo PRD00605→PRD00639 ×3 e o modelo 2x/3x se aplicam de forma consistente, e o modelo selecionado aparece em todos os pontos de visualização do pedido.
