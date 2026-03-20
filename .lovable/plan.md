

## Adicionar filtro por consultor na Carteira CRM

### Arquivos alterados

**1. `src/hooks/useCrmData.ts` — função `useCarteiraData()`**

- Adicionar query `['crm-consultores']` que busca `user_roles` com `role = 'consultor_rplus'`, depois `profiles` com `id IN userIds`, habilitada apenas quando `isAdmin`
- Adicionar `consultores` ao retorno do hook (linha ~125)

**2. `src/pages/crm/CrmCarteira.tsx`**

- Desestruturar `consultores` e `isAdmin` do hook
- Adicionar estado `consultorFilter` (`'todos'` default)
- No `useMemo` de `filtered`, adicionar filtro por `consultor_rplus_id` quando `consultorFilter !== 'todos'`
- No JSX, entre busca e contador, renderizar `Select` de consultores (visível apenas para admin)
- Importar componentes de `Select`

### O que NÃO muda
- Lógica de visibilidade existente (consultor vê só seus clientes)
- Nenhuma outra query do hook
- FAB, navegação, busca, cards

