

## Plano: Permitir que o dono edite e exclua pedidos da coluna "Aberto"

### Estado atual

**Permissões no banco (já corretas — não precisam mudar):**
- `pedidos`: dono (`auth.uid() = solicitante_id`) tem **UPDATE** e **DELETE**.
- `pedido_itens`: dono do pedido pai tem **INSERT**, **UPDATE** e **DELETE**.
- `pedido_item_assets`: dono tem **INSERT** e **DELETE**.
- `pedido_item_log`: usuário pode **INSERT** com seu próprio `user_id`.
- Admins/coordenadores já mantêm acesso total via policies separadas.

**Conclusão:** quem cria um pedido já pode editar e excluir no banco. O problema é só de UI — o `PedidoKanban` na coluna "Aberto" (status `solicitado`) só mostra **Detalhes** e **Processar**, sem ações de editar/excluir para o dono.

### Mudanças (somente front-end)

#### 1. `src/components/pedidos/PedidoKanban.tsx`
- Adicionar duas novas props opcionais:
  - `currentUserId: string | undefined`
  - `onEdit: (pedido) => void`
  - `onDelete: (pedido) => void`
  - `canManage: boolean` (admin/coordenador — já tem acesso por outro caminho, mas usaremos pra liberar os botões mesmo que não seja dono)
- No `renderAction` da coluna **"Aberto"**, quando `pedido.solicitante_id === currentUserId` **OU** `canManage === true`:
  - Adicionar botão ícone **Pencil** (Editar) → chama `onEdit(pedido)`.
  - Adicionar botão ícone **Trash2** (Excluir) com cor `destructive` → chama `onDelete(pedido)`.
- Layout: os ícones ficam à esquerda do botão "Processar" no mesmo `flex` do card, mantendo o visual atual (h-7, gap-1).
- **Importante:** colunas "Em Processamento" e "Concluído" continuam sem essas ações (regra atual preservada — só "Aberto" libera edição/exclusão).

#### 2. `src/pages/Pedidos.tsx`
- Reaproveitar o handler de edição existente (`handleEditPedido`) — o dialog `Novo/Editar Pedido` já funciona para qualquer status, mas precisamos garantir que ao editar um pedido **`solicitado`** os campos certos sejam carregados.
  - **Ajuste no handler `handleSubmit`**: hoje, ao editar, ele faz `delete` em todos os `pedido_itens` e re-`insert`. Isso quebra o histórico (`pedido_item_log`) e os vínculos de assets. Para pedidos `solicitado`, vamos:
    - Manter o caminho atual **somente para rascunhos** (`status === 'rascunho'`).
    - Para `solicitado`, **delegar para o componente `EditarPedidoSolicitado`** que já existe e faz cancel/qty-change/add com log adequado.
  - Alternativa mais simples (preferida para esta iteração): abrir o **mesmo dialog** com o componente `EditarPedidoSolicitado` quando `editingPedido.status === 'solicitado'`, igual já é feito quando o pedido é aberto pelo botão Visualizar/Editar do detalhe. Isso evita duplicar lógica.
- Criar handler `handleDeletePedidoSolicitado(pedido)`:
  - Confirmação destrutiva via `AlertDialog` (texto: "Excluir pedido `{pedido_code}` permanentemente? Esta ação não pode ser desfeita.").
  - Sequência de delete (mesma ordem usada na exclusão admin recente):
    1. `pedido_item_assets` por `pedido_item_id IN (...)`.
    2. `pedido_item_log` por `pedido_id`.
    3. `pedido_itens` por `pedido_id`.
    4. `pedidos` por `id`.
  - `try/catch` com toast de sucesso/erro e `invalidateQueries(['pedidos'])`.
- Passar para o `<PedidoKanban>` as novas props: `currentUserId={user?.id}`, `canManage={canManagePedidos}`, `onEdit={handleEditPedido}`, `onDelete={(p) => setPedidoToDelete(p)}`.
- Adicionar `AlertDialog` controlado por `pedidoToDelete` no JSX da página.

#### 3. Comportamento esperado (após o fix)

| Coluna | Solicitante (dono) | Admin/Coord. logística/serviços | Outros |
|---|---|---|---|
| **Aberto** | Detalhes • **Editar** • **Excluir** • Processar* | Detalhes • Editar • Excluir • Processar | Detalhes |
| **Em Processamento** | Detalhes | Detalhes • Concluir | Detalhes |
| **Concluído** | Detalhes | Detalhes | Detalhes |

\* O botão "Processar" continua aparecendo na coluna Aberto para todos (comportamento atual preservado — admin/coord. é que conclui efetivamente; RLS de UPDATE pra mover para `processamento` permite tanto dono quanto admin).

### Garantias de segurança

- Botão de excluir só aparece se `pedido.status === 'solicitado'` E (dono OU admin/coord.) — validação na UI.
- Mesmo se alguém burlar a UI, o RLS já bloqueia: `DELETE` em `pedidos` exige `auth.uid() = solicitante_id` ou ser admin/coord.
- Histórico (`pedido_item_log`) é apagado junto na exclusão para evitar registros órfãos — consistente com a exclusão de SP-00000109 feita antes.

### Fora de escopo

- Nenhuma migration SQL — RLS já está correto.
- Nenhuma alteração nas colunas "Em Processamento" e "Concluído".
- `EditarPedidoSolicitado` (componente já existente) não precisa de mudança — só passa a ser usado no fluxo de edição direto pelo Kanban.
- Nenhuma mudança em outras telas (Detalhe do Pedido, lista em tabela, etc.).

