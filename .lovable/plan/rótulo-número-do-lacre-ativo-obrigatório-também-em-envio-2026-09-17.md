# Rótulo "Número do Lacre" + ativo obrigatório também em Envio

## Mudanças

### 1. `src/components/pedidos/AssetSearchField.tsx` (linha 148)
- Trocar o rótulo `Código do Ativo (se aplicável)` por `Número do Lacre:`.
- Reflexo automático (nenhuma edição extra): ProcessarPedidoDialog.tsx, ConcluirPedidoDialog.tsx e a criação em Pedidos.tsx usam este componente via MultiAssetField.
- `src/components/oficina/NovaOSDialog.tsx` permanece intocado (rótulo próprio, contexto de OS).

### 2. `src/pages/Pedidos.tsx` (linhas 856-860)
Simplificar `requiresAssetsOnCreate` para não filtrar por tipo de solicitação:

```ts
// Antes
const requiresAssetsOnCreate =
  !editingPedido &&
  (form.tipo_solicitacao === 'coleta_reversa' || (form.tipo_solicitacao === 'envio' && form.gera_coleta_reversa)) &&
  assetItens.length > 0;

// Depois
const requiresAssetsOnCreate = !editingPedido && assetItens.length > 0;
```

Efeito: a seção "Ativos a coletar" (render e validação `missingAssetItem`) passa a aparecer em qualquer criação — inclusive Envio comum — sempre que houver item com peça `is_asset`. Toda a lógica existente de `itemAssets`, `missingAssetItem`, `saveAssetsForItems` e gravação em `pedido_item_assets`/`workshop_item_id` permanece igual.
- Atualizar o comentário da linha 2019 (`{/* Ativos a coletar (Coleta Reversa...) */}`) para refletir que vale para qualquer tipo.

## Fora de escopo
- Sem migration, sem mudança de schema, sem mudança em NovaOSDialog.tsx, sem alteração nas validações de motivo/relato, volumes ou fluxos de Coleta Reversa.

## Validação
- Typecheck (`tsgo --noEmit`) e build.
- Playwright: abrir "Novo Pedido" na visão "Todos" (Envio comum) com uma peça `is_asset` e confirmar que a seção "Ativos a coletar" aparece com o rótulo "Número do Lacre:" e bloqueia salvar sem vínculo.
