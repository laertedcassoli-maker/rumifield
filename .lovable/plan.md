## Problema

A tela de Solicitação de Peças usa `useQuery` com `staleTime: 60_000` para listar as peças do catálogo. Quando uma nova peça é cadastrada (via Omie sync, admin, ou outro usuário), ela só aparece após refresh manual ou após expirar o cache.

## Solução

Habilitar Realtime na tabela `pecas` e criar um hook reutilizável que invalida automaticamente as queries de catálogo de peças sempre que houver INSERT/UPDATE/DELETE em `pecas`.

## Mudanças

### 1. Migration: habilitar Realtime
```sql
ALTER TABLE public.pecas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pecas;
```

### 2. Novo hook `src/hooks/useRealtimePecas.ts`
Subscreve ao canal `pecas-changes` e invalida as queryKeys do catálogo (`pedidos-pecas`, `parts-catalog-active`, `pecas-edit-pedido`, etc.) ao detectar mudanças.

### 3. Usar o hook nas telas de Solicitação de Peças
- `src/pages/Pedidos.tsx` (queryKey `pedidos-pecas`)
- `src/components/chamados/TicketPartsRequestPanel.tsx` (queryKey `parts-catalog-active`)
- `src/components/pedidos/EditarPedidoSolicitado.tsx` (catálogo no modal de edição)

Cada chamada do hook recebe a lista de queryKeys a invalidar.

## Resultado

Ao cadastrar/ativar/desativar uma peça (manualmente ou via sync Omie), todas as telas abertas de Solicitação de Peças refletem a mudança em segundos, sem refresh manual.