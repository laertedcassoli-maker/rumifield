
## Problema

Quando um coordenador (ex: Ivan) tenta excluir um pedido na tela de Solicitação de Peças, o card permanece visível mesmo após o toast de sucesso. Causa raiz:

- As RLS policies de DELETE em `pedidos`, `pedido_itens` e `pedido_item_assets` exigem `solicitante_id = auth.uid()`.
- A tabela `pedido_item_log` não tem nenhuma policy de DELETE.
- Coordenadores conseguem excluir filhos parcialmente (alguns sem policy bloqueiam), mas o `DELETE` em `pedidos` é filtrado silenciosamente pelo RLS — 0 linhas afetadas, sem erro retornado.
- O frontend interpreta como sucesso e o card "fantasma" continua no banco.

## Mudanças

### 1. Migration SQL — adicionar policies de DELETE para roles administrativas

Para `admin`, `coordenador_logistica` e `coordenador_servicos`, criar policies permissivas adicionais (não substituem as existentes do dono):

- `public.pedidos` — DELETE permitido se `has_role(auth.uid(), 'admin' | 'coordenador_logistica' | 'coordenador_servicos')`.
- `public.pedido_itens` — mesma regra.
- `public.pedido_item_assets` — mesma regra.
- `public.pedido_item_log` — criar policy de DELETE (hoje não existe nenhuma) com a mesma regra E também permitir o dono do pedido pai (via JOIN em `pedidos`), espelhando o padrão das outras tabelas filhas.

Resultado: dono continua excluindo seus próprios pedidos; admin/coord. logística/coord. serviços excluem qualquer pedido; ninguém mais pode excluir.

### 2. `src/pages/Pedidos.tsx` — detecção de falha silenciosa

No `handleDeletePedidoSolicitado` (linhas 416-459):

- Trocar o `delete()` final em `pedidos` por `.delete().eq('id', ...).select('id')`.
- Após o delete, validar `if (!data || data.length === 0) throw new Error('Não foi possível excluir o pedido. Verifique suas permissões.')`.
- Trocar `queryClient.invalidateQueries(...)` por `await queryClient.invalidateQueries({ queryKey: ['pedidos'] })` para garantir que a UI só atualiza depois do refetch.

Assim, se no futuro alguma policy bloquear silenciosamente novamente, o usuário verá um erro explícito em vez de um card fantasma.

## Resultado esperado

- Ivan (coord. logística/serviços) e admins conseguem excluir qualquer pedido; o card desaparece imediatamente.
- Usuários comuns continuam excluindo apenas seus próprios pedidos (regra atual).
- Falhas de permissão futuras geram toast vermelho explícito, sem cards fantasmas.
