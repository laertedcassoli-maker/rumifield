# Fase 5 — Processar a pendência da Coleta Reversa (Código de Rastreio)

Uma Coleta Reversa em "Pendente" passa a ter uma ação de "Processar", disponível para o responsável definido na criação (técnico, CSM, ou o solicitante quando o tipo de coleta é Correios) e para admin/coordenadores. Nela informa-se o Código de Rastreio (obrigatório) e, opcionalmente, um anexo. Ao confirmar, a solicitação vai para "Em Processamento".

## O que muda

1. Banco: duas colunas novas em solicitações (código de rastreio e caminho do anexo de rastreio), ambas opcionais.
2. Permissão: o responsável técnico/CSM passa a poder atualizar a própria pendência (hoje só o solicitante e admin/coordenador conseguem).
3. Novo diálogo "Processar Pendência": campo "Código de Rastreio:" obrigatório + anexo opcional.
4. Quadro (Kanban): a coluna "Pendente" ganha o botão "Processar" para quem tem permissão.
5. Lista somente-leitura: mesmo botão "Processar" aparece para o responsável, ao lado de "Detalhes".

## Confirmação assumida

O "Concluir" (Número da NF + Data de Faturamento) continua sendo ação de admin/coordenador apenas — nada muda nele. Se quiser diferente, avise antes.

## Detalhes técnicos

**Migration**
- `ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS codigo_rastreio text, ADD COLUMN IF NOT EXISTS anexo_rastreio_path text;`
- Nova policy (as existentes ficam intactas):
  `CREATE POLICY "Responsaveis can update assigned pedidos" ON public.pedidos FOR UPDATE TO authenticated USING (tecnico_responsavel_user_id = auth.uid() OR csm_responsavel_user_id = auth.uid());`
- Regenerar `src/integrations/supabase/types.ts` ao final.

**Novo componente `src/components/pedidos/ProcessarPendenciaDialog.tsx`**
- Estrutura copiada de `ProcessarPedidoDialog.tsx` (Dialog + Label + Input + botões Cancelar/Confirmar), sem tocar no original.
- Campos: `codigoRastreio` (obrigatório — toast destrutivo se vazio, botão permanece clicável, conforme o padrão do projeto) e `anexoFile` (`input type="file"`, opcional).
- `onConfirm(codigoRastreio: string, anexoFile?: File)`; estado limpo ao fechar/confirmar.

**`src/pages/Pedidos.tsx`**
- Novo `handleProcessarPendencia(pedidoId, codigoRastreio, anexoFile?)` (mesmo padrão de `handleProcessar`, sem alterá-lo): se houver anexo, upload em `pedido-anexos/<pedido_id>/<timestamp>-<nome>` e, em caso de erro, interrompe antes do update; depois `update({ status: 'processamento', codigo_rastreio, anexo_rastreio_path? })`, invalidação de `['pedidos']`, `track('pedido_pendencia_processada')` e toast de sucesso.
- Helper `isResponsavelPendencia(pedido)`: `pedido.tecnico_responsavel_user_id === user?.id || pedido.csm_responsavel_user_id === user?.id || (pedido.tipo_coleta === 'correios' && pedido.solicitante_id === user?.id)`.
- Lista somente-leitura (bloco de ações ~linha 2467): quando `pedido.status === 'pendente' && isResponsavelPendencia(pedido)`, botão "Processar" que abre o novo diálogo (state `pendenciaPedido`). O diálogo é renderizado uma vez na página. Nada muda para os outros status.

**`src/components/pedidos/PedidoKanban.tsx`**
- Novas props: `onProcessarPendencia` e `isResponsavelPendencia?: (p: PedidoComItens) => boolean`.
- Coluna "Pendente": `renderAction` passa a exibir o botão "Processar" quando `canManage || isResponsavelPendencia?.(pedido)`, abrindo o `ProcessarPendenciaDialog` (novo state `pendenciaPedidoId`), com o mesmo visual do botão "Processar" da coluna "Aberto". Demais colunas intactas.

**Não alterado:** `ProcessarPedidoDialog.tsx`, `ConcluirPedidoDialog.tsx`, `handleConcluir`, policies existentes, todo o fluxo de Envio, statusLabels/statusColors, e nada de aba "Pendentes"/"Minhas Pendências" (Fases 6 e 7).

## Validação
Typecheck + build, e teste no preview: criar/usar uma Coleta Reversa em "Pendente", confirmar que o botão "Processar" aparece, que o Código de Rastreio é exigido, que o anexo sobe e que o status vira "Em Processamento".
