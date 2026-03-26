

## Alterar filtro padrão de data para "30 dias" na tela de Pedidos

### Alteração

**Arquivo:** `src/pages/Pedidos.tsx`

**Linha 101** — mudar o valor inicial de `dateFilter` de `'all'` para `'30'`:

```ts
// DE:
const [dateFilter, setDateFilter] = useState<'30' | 'all'>('all');

// PARA:
const [dateFilter, setDateFilter] = useState<'30' | 'all'>('30');
```

### Confirmação

O filtro de 30 dias já filtra pelos **últimos 30 dias** (linhas 164-169): calcula `cutoffDate = hoje - 30 dias` e compara com `created_at` do pedido. Lógica correta, apenas o default precisa mudar.

### O que NÃO muda
- Lógica de filtragem, botões, clearFilters, nenhum outro comportamento

