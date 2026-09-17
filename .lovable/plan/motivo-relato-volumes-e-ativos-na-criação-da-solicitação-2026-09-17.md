# Motivo/relato, volumes e ativos na criação da solicitação

Adiciona ao formulário de criação de Solicitação de Peças o motivo/relato (obrigatório sempre) e, para Coleta Reversa, a quantidade de volumes e o vínculo de ativos já na criação.

## O que muda para o usuário

1. **Novo campo obrigatório "Motivo da solicitação e relato da fazenda:"** (caixa de texto), logo acima de Observações, tanto em Envio quanto em Coleta Reversa. Sem preencher, o botão de salvar mostra um aviso e não avança.
2. **Somente em Coleta Reversa:** novo campo obrigatório "Quantidade de Volumes:" (número, mínimo 1).
3. **Somente em Coleta Reversa:** se alguma peça escolhida for do tipo que exige ativo, aparece abaixo da lista de peças a seção "Ativos a coletar", com a mesma busca de ativos já usada na etapa de Processar. Cada peça dessas precisa de pelo menos um ativo vinculado para salvar.
4. **Envio continua igual:** nenhuma exigência de ativo na criação — o vínculo segue acontecendo só no Processar.
5. **Tela de revisão antes de salvar:** passa a mostrar o motivo/relato, a quantidade de volumes (quando Coleta Reversa) e os ativos vinculados.
6. **Envio com "Gera automaticamente coleta reversa? = Sim":** o motivo/relato é copiado para a coleta reversa gerada, e passam a ser exigidos também a quantidade de volumes e os ativos (quando aplicável) dessa coleta — os mesmos campos aparecem no bloco da coleta reversa automática.

Pedidos já existentes não são afetados: a exigência vale só para novas criações.

## Detalhes técnicos

### Migration
`ALTER TABLE public.pedidos ADD COLUMN motivo_relato text, ADD COLUMN quantidade_volumes integer;` (ambas nullable, sem CHECK). Nenhuma policy alterada. `src/integrations/supabase/types.ts` regenerado ao final; `src/types/pedidos.ts` (`PedidoComItens`) ganha `motivo_relato?: string | null` e `quantidade_volumes?: number | null`.

### `src/pages/Pedidos.tsx`
- `emptyForm` (linha 52) ganha `motivo_relato: ''`, `quantidade_volumes: ''`, `coleta_auto_volumes: ''`. `openEdit` (~727) carrega `motivo_relato` e `quantidade_volumes` do pedido.
- Novo state `itemAssets: Record<number, string[]>` (índice do item em `itens` → workshop_item_ids), limpo nos mesmos pontos em que `itens` é resetado e ao remover/trocar peça de um índice.
- UI (form, após o bloco de peças ~1828 e antes/depois de Observações):
  - `Textarea` "Motivo da solicitação e relato da fazenda:" ligado a `form.motivo_relato`.
  - `Input type="number" min={1}` "Quantidade de Volumes:" renderizado só com `form.tipo_solicitacao === 'coleta_reversa'`.
  - Seção "Ativos a coletar": só quando `tipo_solicitacao === 'coleta_reversa'` e existe item cuja `peca.is_asset === true`; para cada um, `<MultiAssetField pecaId={item.peca_id} pecaNome quantidade={item.quantidade} selectedAssets={itemAssets[index] || []} onAssetsChange={...} />`.
  - No bloco da coleta reversa automática (Envio + `gera_coleta_reversa`): mesmos campos de volumes (`coleta_auto_volumes`) e a mesma seção de ativos, reutilizando `itemAssets` (os itens são os mesmos do envio).
- `handleShowConfirmation` (815) ganha, na ordem, após as validações atuais:
  - `!form.motivo_relato.trim()` → toast "Informe o motivo da solicitação e o relato da fazenda".
  - Coleta Reversa: `Number(form.quantidade_volumes) >= 1` obrigatório; e cada item com `is_asset` precisa de ao menos um id não vazio em `itemAssets[index]`.
  - Envio + `gera_coleta_reversa` e sem `editingPedido`: mesmas duas validações usando `coleta_auto_volumes` e `itemAssets`.
- Revisão (~1204): novas linhas no bloco resumo — motivo/relato, quantidade de volumes (quando aplicável) e códigos de ativos vinculados por peça.
- `handleSubmit`:
  - update (866) e insert do envio (894) passam `motivo_relato: form.motivo_relato`, `quantidade_volumes: tipo_solicitacao === 'coleta_reversa' ? Number(form.quantidade_volumes) : null`.
  - Insert dos itens passa a usar `.select('id, peca_id')` para obter os ids; quando Coleta Reversa e há ativos, gravar `workshop_item_id` (primeiro ativo) + `asset_codes` no `pedido_itens` e as linhas em `pedido_item_assets`, seguindo exatamente o padrão já usado em `applyAutoLinks` (~1030-1090). Falha nessa gravação mantém o rollback já existente do pedido.
  - Coleta reversa automática (944): insert recebe `motivo_relato: form.motivo_relato`, `quantidade_volumes: Number(form.coleta_auto_volumes)`, e após inserir seus itens grava os mesmos ativos; o comportamento de falha continua o atual (não reverte o envio, toast de aviso).

### Não alterado
`ProcessarPedidoDialog.tsx`, `ConcluirPedidoDialog.tsx`, dialog de detalhe (`viewingPedido`), `applyAutoLinks`, fluxo de rascunho/transmissão, filtros e demais validações. Nada de status "Pendente", anexos ou rastreio nesta etapa.
