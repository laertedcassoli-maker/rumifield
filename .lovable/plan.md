Plano para exibir a quantidade de peças/itens em OS de execução em lote (LOTE) no dialog de detalhes.

Arquivo: `src/components/oficina/DetalheOSDialog.tsx` (único arquivo alterado).

Mudanças:
1. Próximo à definição de `univocaItem` (linha ~1049), adicionar `const loteItem = workOrderItems.find(item => !item.workshop_item_id && item.omie_product_id);` para identificar itens de lote.
2. Adicionar um novo bloco de renderização, como sibling do bloco `{univocaItem && (...)}` (linha ~1239-1290), condicionado a `{loteItem && (...)}`.
3. O novo bloco seguirá o padrão visual do bloco "Item" existente (título, card com borda, Badge para o nome do produto), mas mostrará:
   - `loteItem.product_name` como nome do produto.
   - `loteItem.quantity` de forma destacada (ex: "Quantidade: 29" ou badge grande).
4. O bloco de lote não incluirá horímetro/motor, pois isso só se aplica a ativos únicos.
5. Os dois blocos (UNIVOCA e LOTE) serão mutuamente exclusivos por natureza, já que uma OS de lote tem `workshop_item_id` null.

Nenhuma outra lógica será alterada (cronômetro, peças usadas, motor, etc.).