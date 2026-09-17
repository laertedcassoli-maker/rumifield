# Fase 4 — Processar Coleta Reversa: status "Pendente", Código de Postagem e anexo

## O que muda para o usuário

- Ao processar uma **Coleta Reversa**, a Logística passa a informar:
  - **Código de Postagem** (obrigatório) quando a logística escolhida for **Correios**;
  - um **anexo opcional** (comprovante/etiqueta), em qualquer tipo de logística.
- Ao confirmar, a Coleta Reversa passa para o novo status **Pendente** (em vez de "Em Processamento"), indicando que está aguardando ação do responsável já definido na criação.
- O status **Pendente** aparece rotulado e colorido na listagem, no quadro (Kanban) e no detalhe do pedido.
- **Envio continua exatamente como hoje**: nenhum campo novo, e segue para "Em Processamento".

## Banco de dados

Nova migration:
- `ALTER TYPE pedido_status ADD VALUE 'pendente'` (em migration própria, antes do uso).
- `pedidos`: novas colunas `codigo_postagem text`, `anexo_postagem_path text` (ambas nullable — nenhum pedido existente é afetado).
- Novo bucket de storage privado `pedido-anexos`, arquivos organizados em `<pedido_id>/<arquivo>`.
- Políticas em `storage.objects` (SELECT/INSERT/UPDATE/DELETE) para o bucket, sempre casando a primeira pasta do path com um pedido via subquery:
  ```sql
  bucket_id = 'pedido-anexos' AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.solicitante_id = auth.uid()
        OR p.tecnico_responsavel_user_id = auth.uid()
        OR p.csm_responsavel_user_id = auth.uid()
        OR public.is_admin_or_coordinator(auth.uid()))
  )
  ```
  Somente `authenticated`; nunca `USING (true)` nem acesso anônimo.
- `src/integrations/supabase/types.ts` regenerado ao final.

## Front-end

`src/components/pedidos/ProcessarPedidoDialog.tsx`
- Novo bloco renderizado só quando `pedido?.tipo_solicitacao === 'coleta_reversa'`:
  - campo **Código de Postagem** quando `tipoLogistica === 'correios'` (obrigatório: botão Processar mostra toast de erro se vazio, seguindo o padrão do projeto de não desabilitar silenciosamente);
  - campo de arquivo (`input type=file`) opcional.
- `onConfirm` ganha dois argumentos opcionais extras: `codigoPostagem?: string`, `anexoFile?: File`. Assinatura atual preservada para o fluxo de Envio (valores ficam `undefined`).
- Estado limpo ao confirmar/fechar, como já ocorre com `tipoLogistica`/`itemsWithAssets`.

`src/pages/Pedidos.tsx`
- `handleProcessar` recebe os dois novos parâmetros opcionais. Determina `isColetaReversa` pelo pedido em memória (`pedidos.find`) e:
  - Envio → `status: 'processamento'` (idêntico a hoje);
  - Coleta Reversa → `status: 'pendente'`, mais `codigo_postagem` quando preenchido; se houver anexo, upload para `pedido-anexos/<pedido_id>/<timestamp>-<nome>` e gravação do path em `anexo_postagem_path`. Falha de upload interrompe com toast de erro antes de mudar o status.
  - Toast final adaptado ("Coleta reversa marcada como pendente!").
- `statusColors`/`statusLabels`: entrada `pendente` → label "Pendente", cor de destaque (tom âmbar/warning distinto do "Em Processamento").
- `statusOrder` (ordenação da lista): `pendente` entre `solicitado` e `processamento`.
- `PedidoKanban.tsx`: nova coluna **Pendente** entre "Aberto" e "Em Processamento", listando `status === 'pendente'`; cards com o mesmo layout e a ação "Concluir" (mesmo tratamento da coluna Em Processamento, já que o Concluir da Coleta Reversa é a Fase 5). Nenhuma coluna existente removida ou alterada.

## Fora de escopo (fases seguintes)

Aba "Pendentes", tela "Minhas Pendências", notificações, código de rastreio no Concluir, `ConcluirPedidoDialog.tsx`.

## Validação

- Typecheck + build.
- No preview: processar uma Coleta Reversa com Correios exige o Código de Postagem; com Transportadora/Entrega Própria não exige e aceita anexo; após confirmar o status exibido é "Pendente".
- Processar um Envio: dialog sem campos novos e status "Em Processamento".
