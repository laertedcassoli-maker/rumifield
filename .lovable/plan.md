
## Corrigir Modal Cortado na Edição de Pedidos

### Problema
O modal de detalhes/edição do pedido está sendo cortado na tela. Isso acontece porque:
1. O `DialogContent` usa posicionamento central (`top-[50%] translate-y-[-50%]`) com `max-h-[85vh]`, que pode cortar conteúdo em telas menores
2. O componente de edição tem áreas de scroll internas (`max-h-[35vh]`) dentro do dialog já restrito, causando conflito de scroll

### Solução

**1. Ajustar o DialogContent no Pedidos.tsx (linha 1345)**
- Trocar de `max-h-[85vh] overflow-y-auto` para classes que garantam o scroll funcionar bem com o posicionamento central do dialog
- Usar `max-h-[90vh] flex flex-col` no DialogContent para que o conteúdo se ajuste corretamente

**2. Ajustar o EditarPedidoSolicitado.tsx**
- O container principal (`div.space-y-4`) precisa de `flex-1 overflow-y-auto min-h-0` para funcionar dentro do flex do dialog
- Ajustar o `max-h-[35vh]` dos itens para `flex-1 max-h-[40vh]` para aproveitar melhor o espaço
- Garantir que os botões de ação fiquem sempre visíveis (sticky no fundo)

### Mudanças Específicas

**`src/pages/Pedidos.tsx`** - Linha 1345:
- Alterar classe do DialogContent para: `max-w-lg max-h-[90vh] overflow-y-auto`

**`src/components/pedidos/EditarPedidoSolicitado.tsx`**:
- Reduzir margens e padding internos para mobile
- Garantir que a lista de itens não empurre os botões para fora da tela
- Os botões "Cancelar" e "Salvar" ficam sempre acessíveis

### Resultado
O modal vai exibir todo o conteúdo sem cortar, com scroll interno funcional e botões de ação sempre visíveis.
