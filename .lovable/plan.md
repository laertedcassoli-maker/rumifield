
## Vincular ativo direto no detalhe do pedido (botao de lapis)

### O que muda
Ao lado do badge "Ativo nao vinculado", sera adicionado um botao de lapis (Pencil) que abre um popover inline com o componente `AssetSearchField`. Ao selecionar um ativo, o sistema salva imediatamente no banco (`pedido_itens.workshop_item_id`) e atualiza a tela.

### Alteracoes

**`src/pages/Pedidos.tsx`**

1. Importar o componente `AssetSearchField` e adicionar estado para controlar qual item esta sendo editado (`editingAssetItemId`)
2. No trecho do badge "Ativo nao vinculado" (linha ~1348), adicionar um botao Pencil ao lado
3. Ao clicar no lapis, exibir o `AssetSearchField` inline (abaixo do badge) para o item correspondente
4. Criar funcao `handleAssetLinked(itemId, workshopItemId)` que:
   - Faz `UPDATE pedido_itens SET workshop_item_id = ? WHERE id = ?` via Supabase
   - Atualiza o `viewingPedido` no estado local para refletir a mudanca
   - Exibe toast de sucesso
5. Quando o ativo ja esta vinculado (badge verde), tambem permitir editar com o lapis

### Detalhes tecnicos

- O `AssetSearchField` ja recebe `pecaId` e retorna o `workshopItemId` selecionado -- basta reutiliza-lo
- A atualizacao vai direto no Supabase (online) e tambem atualiza o Dexie local para manter consistencia
- O botao de lapis so aparece quando o pedido esta em status editavel (solicitado, processamento) -- nao em faturado/enviado/entregue
