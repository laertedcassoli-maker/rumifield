Plano de correção para exibir a quantidade de peças em OS de execução em lote (LOTE) na listagem de Ordens de Serviço.

Arquivo: `src/pages/oficina/OrdensServico.tsx` (único arquivo alterado).

Mudanças:
1. Adicionar `quantity` ao select de `work_order_items` na query principal.
2. Incluir `quantity` na tipagem `itemsMap` e no objeto gerado para cada OS.
3. Na renderização desktop (tabela), mostrar um indicador de quantidade (ex: "Qtd: 29") ao lado ou abaixo do `product_name`, apenas quando `quantity > 1`.
4. Na renderização mobile (card), adicionar o mesmo indicador de quantidade no bloco equivalente, também condicionado a `quantity > 1`.

Nenhuma outra lógica de busca, filtro, ordenação ou exibição será alterada. A exibição da quantidade será opcional e só aparecerá para lotes com mais de 1 item, evitando poluir OS de item único.