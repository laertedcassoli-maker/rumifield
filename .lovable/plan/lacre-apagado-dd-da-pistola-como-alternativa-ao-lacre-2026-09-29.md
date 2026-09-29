# Lacre apagado: DD da Pistola como alternativa ao lacre

## O que muda para o usuário
- Cada unidade de ativo ganha a caixa "Lacre apagado". Marcada, a busca de lacre some e aparece o campo "DD da Pistola".
- Um DD preenchido conta como vinculado. A unidade libera o envio. Unidade sem lacre e sem DD continua bloqueando.
- No detalhe do pedido, o DD aparece num selo próprio "🔧 DD: {valor}", separado do selo "🏷️" do lacre.
- Vale em todo lugar que já usa esse campo: criação (envio, coleta automática, coleta reversa manual), Processar e Concluir pedido.

## Passos
1. **Migração em `pedido_item_assets`:** `workshop_item_id` passa a aceitar vazio. Nova coluna `dd_pistola_manual text` (pode ficar vazia). Uma regra CHECK exige pelo menos um dos dois.
2. **AssetSearchField.tsx:** caixa "Lacre apagado" acima da busca. Marcada, mostra o campo de texto "DD da Pistola" (placeholder "Digite o DD da pistola") e esconde a busca. Novas props: `manualCode` e `onManualCodeChange(value | null)`. Marcar limpa o lacre escolhido. Desmarcar limpa o DD. A criação de ativo não muda.
3. **MultiAssetField.tsx:** o slot de cada unidade guarda um lacre ou um DD. Formato: `string[]`, e o DD é gravado como `"dd:<valor>"`. Helpers `isManualDD`, `toManualDD`, `fromManualDD` ficam em `src/lib/asset-slots.ts`. Assim, Processar e Concluir continuam compatíveis sem mudar o tipo.
4. **Pedidos.tsx:**
   - `missingAssetItem` e `faltaLacre` já usam `filter(Boolean)`. Um DD preenchido conta automaticamente. Um DD vazio vira `''` e continua bloqueando.
   - `buildAssetsByPecaId` repassa os dois tipos de valor.
   - `saveAssetsForItems`, a inserção da linha ~1416 e a edição da linha ~1552 gravam as linhas assim: lacre → `workshop_item_id`; DD → `workshop_item_id = null` + `dd_pistola_manual`.
   - `pedido_itens.workshop_item_id` só recebe o primeiro lacre real, e os DDs são ignorados. É o mesmo comportamento condicional de hoje.
   - Os 3 selects de `pedido_item_assets` (linhas 358, 403 e 439) passam a trazer `dd_pistola_manual`. O preenchimento na edição (linha ~912) volta a montar os slots `"dd:"`.
   - Detalhe do pedido (linha ~3211): mostra o selo 🔧 "DD: {valor}", com estilo diferente, para as linhas com DD.
5. **ProcessarPedidoDialog / ConcluirPedidoDialog:** separar os slots `"dd:"` na hora de gravar, usando o mesmo helper.
6. **Tipos:** `PedidoItemAsset.workshop_item_id` passa a aceitar vazio, e entra `dd_pistola_manual?: string | null`.

## Não muda
Criação de ativo em `workshop_items`, a regra de `pedido_itens.workshop_item_id` e a publicação (fica só na prévia).

## Validação
Checagem de código e build. No app: marcar "Lacre apagado", digitar o DD e enviar. Conferir o selo 🔧 no detalhe. Desmarcar deve voltar a exigir o lacre. Deixar a unidade vazia deve continuar bloqueando.
