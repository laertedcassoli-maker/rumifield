# Reverter exigência de ativo na criação para o escopo da coleta reversa

## Contexto
Em src/pages/Pedidos.tsx (linha 857), o cálculo atual é:

```ts
const requiresAssetsOnCreate = !editingPedido && assetItens.length > 0;
```

Isso passou a exigir o vínculo de "Número do Lacre" em qualquer Envio com peça is_asset, mesmo sem coleta reversa automática. A exigência deve voltar ao escopo anterior.

## Mudança (uma linha + comentário)
Linha 857 passa a ser:

```ts
const requiresAssetsOnCreate =
  !editingPedido &&
  (form.tipo_solicitacao === 'coleta_reversa' ||
    (form.tipo_solicitacao === 'envio' && form.gera_coleta_reversa)) &&
  assetItens.length > 0;
```

Comentário da linha 856 atualizado para refletir a regra: ativos exigidos na criação para Coleta Reversa (manual) e para Envio com "Gera automaticamente coleta reversa?" marcado — Envio comum volta a vincular ativo só no Processar.

## Não alterar
- Rótulo "Número do Lacre:" e AssetSearchField.tsx.
- Seção "Ativos a coletar", itemAssets, gravação em pedido_item_assets/workshop_item_id.
- Comportamento de Processar/Concluir de Coleta Reversa (pular ativos / NF adicional).
- Trava de tipo no "Novo Pedido", validações de motivo/volumes, demais fluxos.
- Nenhuma migration — sem mudança de schema.

## Critérios de aceite
- Envio comum (sem coleta reversa automática) com item is_asset: sem exigência de ativo na criação; vínculo volta a ocorrer só no Processar.
- Envio com "Gera automaticamente coleta reversa? = Sim" e item is_asset: continua exigindo o vínculo na criação.
- Coleta Reversa manual com item is_asset: continua exigindo, sem mudança.

## Validação
- Typecheck (tsgo) e build OK.
- Playwright no preview: abrir "Novo Pedido" na visão Todos (Envio padrão), adicionar item com peça is_asset (ex.: DD-DA001-35) e confirmar que a seção "Ativos a coletar" NÃO aparece com o toggle "Gera automaticamente coleta reversa?" desmarcado (Envio comum) — o vínculo volta a ser exigido só no Processar. Em seguida, marcar o toggle e confirmar que a seção passa a aparecer, exigindo o vínculo na criação (comportamento esperado para a coleta reversa que será gerada). Screenshots em /tmp/browser/lacre-scope-revert/.
