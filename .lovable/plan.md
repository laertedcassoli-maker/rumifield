## Objetivo
Tornar o vínculo automático entre **PRD00605** e **PRD00639** proporcional: a quantidade de PRD00639 no pedido deve ser sempre `quantidade total de PRD00605 × 3`, atualizando-se em tempo real conforme o usuário aumenta, diminui ou remove a peça gatilho.

## Comportamento esperado
- Adicionar 1× PRD00605 → cria PRD00639 com qty 3
- Aumentar para 2× PRD00605 → PRD00639 vira qty 6
- Diminuir para 1× PRD00605 → PRD00639 volta para qty 3
- Remover PRD00605 → remove PRD00639
- Vale para qualquer ponto de entrada: criação manual, edição de rascunho, edição de pedido já transmitido e qualquer importação futura (garantido pelo trigger no banco)
- Usuário não pode editar manualmente a quantidade de PRD00639 enquanto houver PRD00605 (ela é derivada)

## O que vou ajustar

### 1. Frontend — `src/pages/Pedidos.tsx`
- Atualizar `applyAutoLinks` para **recalcular** a qty de PRD00639 com base na soma das quantidades de PRD00605 na lista (`total_605 * 3`), não apenas inserir uma vez.
- Disparar `applyAutoLinks` também em `incrementQuantity`, `decrementQuantity` e em qualquer alteração de quantidade da peça gatilho.
- Em `removeItem`, manter o comportamento atual (remove PRD00639 quando o último PRD00605 sai).
- Bloquear edição manual da linha de PRD00639 (campo de quantidade desabilitado e botões +/− ocultos) enquanto existir PRD00605 na lista, com tooltip explicando o vínculo.

### 2. Frontend — `src/components/pedidos/EditarPedidoSolicitado.tsx`
- Replicar a mesma lógica proporcional para que pedidos já transmitidos também respeitem a regra ao serem editados.

### 3. Backend — função `public.auto_link_pedido_pecas` (trigger em `pedido_itens`)
- Trocar a função atual (que só insere qty fixa 3 no INSERT) por uma versão que rode em **INSERT, UPDATE e DELETE** e sempre reconcilie:
  - Calcula `total_605 = SUM(quantidade)` de PRD00605 no pedido.
  - Se `total_605 > 0`: faz `UPSERT` de PRD00639 com `quantidade = total_605 * 3`.
  - Se `total_605 = 0`: remove a linha de PRD00639 do pedido.
- Garantir que o trigger ignore alterações feitas pelo próprio trigger em PRD00639 (evitar recursão), por exemplo checando o código da peça antes de recalcular.
- Recriar o trigger para os três eventos (`AFTER INSERT OR UPDATE OR DELETE`).

### 4. Saneamento de dados existentes
- Rodar uma reconciliação única em todos os pedidos não finalizados que já contêm PRD00605, ajustando a qty de PRD00639 para `total_605 * 3` (ou inserindo/removendo conforme o caso), para alinhar pedidos criados antes deste ajuste.

## Resultado esperado
- Quantidade de PRD00639 sempre proporcional (×3) à quantidade total de PRD00605 no mesmo pedido, em qualquer fluxo.
- Sem necessidade de intervenção manual do usuário sobre PRD00639.
- Trigger no banco garante consistência mesmo para integrações/importações futuras.