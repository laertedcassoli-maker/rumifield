

## Correcao: Badge nao atualiza visualmente apos vincular ativo

### Problema
Ao vincular o ativo 9089 na SP-00000033, o banco e atualizado corretamente (toast de sucesso), mas a tela continua mostrando "Ativo nao vinculado". Isso acontece porque o `handleAssetLinked` atualiza o estado `viewingPedido` com `workshop_item: undefined` em vez de incluir o `unique_code` do ativo selecionado.

### Causa raiz
Linha 487 de `Pedidos.tsx`:
```
workshop_item: workshopItemId ? undefined : null
```
O `undefined` faz com que a condicao `item.workshop_item?.unique_code` seja falsa, e o badge verde nunca aparece.

### Solucao

**`src/pages/Pedidos.tsx` -- funcao `handleAssetLinked`**

1. Antes de atualizar o estado, buscar o `unique_code` do ativo vinculado com um SELECT rapido na tabela `workshop_items`
2. Ao atualizar o `viewingPedido`, setar `workshop_item` com o objeto completo `{ id, unique_code }` em vez de `undefined`

Trecho corrigido:
```tsx
// Buscar unique_code do ativo
let workshopItemData = null;
if (workshopItemId) {
  const { data } = await supabase
    .from('workshop_items')
    .select('id, unique_code')
    .eq('id', workshopItemId)
    .single();
  workshopItemData = data;
}

// Atualizar estado com dados completos
setViewingPedido((prev) => ({
  ...prev,
  pedido_itens: prev.pedido_itens?.map((it) =>
    it.id === itemId
      ? { ...it, workshop_item_id: workshopItemId, workshop_item: workshopItemData }
      : it
  ),
}));
```

### Resultado esperado
Apos vincular o ativo 9089, o badge muda imediatamente de "Ativo nao vinculado" (vermelho) para o badge verde com o codigo do ativo.

