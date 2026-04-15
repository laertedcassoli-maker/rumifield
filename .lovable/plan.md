

## Proposta: Múltiplos ativos por item de pedido (quantidade > 1)

### Problema atual

Quando um `pedido_item` tem `quantidade: 2` para uma peça com `is_asset = true`, só existe um campo `workshop_item_id` (UUID único) — o usuário só consegue vincular 1 ativo.

### Solução proposta

A tabela `pedido_itens` já possui uma coluna `asset_codes` (text[]) que não é utilizada. Vou usá-la em conjunto com uma **nova tabela de junção** para vincular múltiplos `workshop_items` a um único `pedido_item`.

**Nova tabela: `pedido_item_assets`**
```text
pedido_item_assets
├── id (uuid PK)
├── pedido_item_id (uuid FK → pedido_itens.id ON DELETE CASCADE)
├── workshop_item_id (uuid FK → workshop_items.id)
├── created_at (timestamptz)
└── UNIQUE(pedido_item_id, workshop_item_id)
```

RLS: mesmas políticas que `pedido_itens` (leitura pública, insert/update/delete via owner ou admin).

### Mudanças na UI

**1. `AssetSearchField` → novo `MultiAssetField`**

Quando `quantidade > 1`, renderizar N campos de busca de ativo (um por unidade). Exemplo para quantidade 2:

```text
┌─────────────────────────────────┐
│ Peça: Pistola XYZ (Qtd: 2)     │
│                                 │
│  Ativo 1: [Buscar ativo...]     │
│  Ativo 2: [Buscar ativo...]     │
└─────────────────────────────────┘
```

Cada campo funciona igual ao `AssetSearchField` atual, mas retorna um array de `workshop_item_id[]` em vez de um único ID.

**2. Dialogs (`ProcessarPedidoDialog`, `ConcluirPedidoDialog`)**

- Mudar tipo de `itemsWithAssets` de `Record<string, string>` para `Record<string, string[]>`
- Renderizar `MultiAssetField` passando `quantidade` para cada item com `is_asset`

**3. `Pedidos.tsx` — handlers**

- `handleProcessar` / `handleConcluir`: em vez de um `update({ workshop_item_id })`, fazer insert na tabela `pedido_item_assets` (um registro por ativo)
- Manter `workshop_item_id` no `pedido_itens` com o primeiro ativo (retrocompatibilidade)
- Gravar os códigos em `asset_codes[]` para referência rápida

**4. Visualização do pedido**

Na view de detalhe, exibir todos os ativos vinculados ao item (não apenas 1).

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `pedido_item_assets` com RLS |
| `src/components/pedidos/MultiAssetField.tsx` | Novo componente |
| `src/components/pedidos/AssetSearchField.tsx` | Sem mudanças (reutilizado internamente) |
| `src/components/pedidos/ProcessarPedidoDialog.tsx` | Usar `MultiAssetField`, `Record<string, string[]>` |
| `src/components/pedidos/ConcluirPedidoDialog.tsx` | Idem |
| `src/pages/Pedidos.tsx` | Handlers + visualização de múltiplos ativos |
| `src/types/pedidos.ts` | Adicionar tipo `PedidoItemAsset` |

### O que NÃO muda

- Estrutura de `pedido_itens` (mantém `workshop_item_id` para retrocompatibilidade)
- Layout geral, outros módulos
- Lógica de criação de pedido (ativos são vinculados no processamento/conclusão)

