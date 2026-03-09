

## Problema

A rota PREV-2026-00004 não finalizou automaticamente porque existe um bug na lógica de auto-finalização do arquivo `AtendimentoPreventivo.tsx`.

O sistema tem **duas** verificações de auto-finalização em arquivos diferentes, e elas são inconsistentes:

| Arquivo | Lógica | Resultado |
|---|---|---|
| `ExecucaoRota.tsx` (cancelamento) | Verifica se todos são `executado` **ou** `cancelado` | **Correto** |
| `AtendimentoPreventivo.tsx` (conclusão de visita) | Verifica apenas se todos são `executado` (ignora `cancelado`) | **Bug** |

Quando a última visita foi concluída via `AtendimentoPreventivo`, a query buscou itens com status diferente de `executado` — encontrou os 2 cancelados — e **não finalizou a rota**.

## Correção

Alterar a verificação em `AtendimentoPreventivo.tsx` (linhas 288-303) para usar a mesma lógica do `ExecucaoRota.tsx`:

```typescript
// Check if all route items are done (executado or cancelado)
const { data: allItems } = await supabase
  .from('preventive_route_items')
  .select('status')
  .eq('route_id', routeId);

const allDone = allItems?.every(i => i.status === 'executado' || i.status === 'cancelado');
if (allDone && allItems && allItems.length > 0) {
  await supabase
    .from('preventive_routes')
    .update({ status: 'finalizada' })
    .eq('id', routeId);
}
```

Adicionalmente, a rota PREV-2026-00004 precisará ser finalizada manualmente (botão "Finalizar Rota" na tela de detalhe) ou via correção direta no banco, já que o bug impediu a auto-finalização no momento correto.

### Escopo
- 1 arquivo alterado: `src/pages/preventivas/AtendimentoPreventivo.tsx`
- ~6 linhas modificadas
- Sem migração de banco

