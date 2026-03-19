

## Adicionar filtro por criador do pedido (solicitante)

### O que será feito
Adicionar um `Select` dropdown na área de filtros da tela de Pedidos que permite filtrar por solicitante. Visível apenas para admins/coordenadores (quem tem `viewAll`).

### Alterações em `src/pages/Pedidos.tsx`

1. **Novo estado**: `solicitanteFilter` (string, default `'all'`)

2. **Lista de solicitantes únicos**: `useMemo` que extrai os nomes únicos dos pedidos via `pedido.solicitante?.nome` e `pedido.solicitante_id`, gerando uma lista `{id, nome}` para popular o Select.

3. **Filtro no `filteredAndSortedPedidos`**: Adicionar condição `matchesSolicitante` que compara `pedido.solicitante_id === solicitanteFilter` quando não é `'all'`.

4. **UI do Select**: Renderizar um `Select` com label "Solicitante:" na área de filtros (junto aos filtros de Envio/Logística), visível apenas quando `isAdmin && viewAll`.

5. **Reset**: Incluir `setSolicitanteFilter('all')` no `clearFilters` e no `useEffect` de reset de página.

