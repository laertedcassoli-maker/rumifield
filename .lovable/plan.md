
## Correção: Campo de ativo não aparece ao concluir pedido

### Causa raiz
Dois problemas no mapeamento de dados offline:

1. **`is_asset` não mapeado**: Na construção dos pedidos offline (linha 53 de `useOfflinePedidos.ts`), o campo `is_asset` da peça não é incluído no objeto, então `item.pecas?.is_asset` é sempre `undefined` e o filtro nunca encontra itens que precisam de ativo.

2. **`workshop_item_id` ausente no schema offline**: A interface `OfflinePedidoItem` e a tabela Dexie `pedido_itens` não incluem `workshop_item_id`, impedindo a resolução do vínculo com o ativo.

### Alterações

**1. `src/lib/offline-db.ts`**
- Adicionar `workshop_item_id?: string | null` à interface `OfflinePedidoItem`

**2. `src/hooks/useOfflinePedidos.ts` (linha ~53)**
- Incluir `is_asset` no mapeamento da peça:
  ```
  pecas: peca ? { nome: peca.nome, codigo: peca.codigo, familia: peca.familia, is_asset: peca.is_asset } : undefined
  ```
- Resolver `workshop_item` a partir do `workshop_item_id` do item (se disponível no offline) ou deixar como `null` para permitir associação

**3. Sync de pedido_itens**
- Garantir que o sync offline baixa o campo `workshop_item_id` da tabela `pedido_itens` e o `unique_code` do `workshop_items` vinculado

### Resultado esperado
- Ao concluir SP-00000047, o campo "Vincular Ativos" aparecerá para a Válvula Solenóide (que tem `is_asset = true` e `workshop_item_id = null`)
- Após vincular, o ativo será salvo e exibido nos detalhes
