# Excluir pedido em qualquer status (Coordenador/Admin)

## Contexto
Hoje, em `src/pages/Pedidos.tsx` (~linha 2672), o bloco de botões Excluir (e Editar) só aparece quando `pedido.status === 'solicitado'` — um pedido que já saiu de "Solicitado" fica impossível de excluir, mesmo sendo um registro errado.

## Mudança (única em src/pages/Pedidos.tsx)

**1. Condição externa do bloco (~linha 2672)** — trocar:

```tsx
{pedido.status === 'solicitado' && (pedido.solicitante_id === user?.id || canDeleteAnyPedido) && (
```

por:

```tsx
{(pedido.status === 'solicitado'
  ? (pedido.solicitante_id === user?.id || canDeleteAnyPedido)
  : canDeleteAnyPedido) && (
```

**2. Botão "Editar" ganha guarda própria de status** — como o Editar está dentro do fragmento que hoje é todo controlado pelo status "solicitado", envolvê-lo com a mesma regra para que continue restrito:

```tsx
{pedido.status === 'solicitado' && (pedido.solicitante_id === user?.id || canManagePedidos) && (
  ... botão Pencil ...
)}
```

O botão "Excluir" fica como está (sem guarda de status), herdando a nova condição externa.

## Comportamento resultante
- Status "solicitado": igual a hoje — dono do pedido OU admin/coordenador veem Excluir; Editar segue regra atual (dono OU canManagePedidos).
- Qualquer outro status (processamento, faturado, enviado, entregue, pendente): só admin, coordenador_servicos ou coordenador_logistica (`canDeleteAnyPedido`, linha 244) veem o botão Excluir. Solicitante comum não vê.
- Confirmação (AlertDialog) e `handleDeletePedidoSolicitado` intocados — a exclusão já remove itens/vínculos/histórico de forma genérica.

## O que NÃO muda
- Botão Editar (além da guarda de status que ele já tinha via bloco externo), `canDeleteAnyPedido`, `handleDeletePedidoSolicitado`, diálogo de confirmação, Kanban, dialogs de processar/concluir, demais filtros.

## Validação
- `bunx tsgo --noEmit` + build.
- Preview: admin vê "Excluir" em pedido com status fora de "Solicitado"; técnico só vê em pedido próprio em "Solicitado".
