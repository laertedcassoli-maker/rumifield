

## Adicionar filtro por consultor na tela de Tarefas CRM

### Arquivos alterados

**1. `src/hooks/useCrmAcoesData.ts`**

- Expandir select de `crm_actions`: `clientes!inner(id, nome, consultor_rplus_id)`
- Atualizar interface `UnifiedAction.clientes` para incluir `consultor_rplus_id: string | null`
- Adicionar `isAdmin` derivado de `role === 'admin' || role === 'coordenador_rplus'`
- Adicionar query `['crm-consultores']` (mesmo padrão de `usePipelineData`): busca `user_roles` com `consultor_rplus`, depois `profiles`, habilitada apenas quando `isAdmin`
- Adicionar `consultores` e `isAdmin` ao retorno

**2. `src/pages/crm/CrmAcoes.tsx`**

- Desestruturar `consultores` e `isAdmin` (renomear uso de `isAdminOrCoord` onde necessário para exibição do filtro)
- Adicionar estado `consultorFilter` (`'todos'` default)
- No `useMemo`, após filtro de busca: `if (consultorFilter !== 'todos') result = result.filter(a => a.clientes?.consultor_rplus_id === consultorFilter)`
- Adicionar `consultorFilter` às deps do `useMemo`
- No JSX, entre filtros de status e contador, renderizar `Select` de consultores (visível apenas para `isAdmin`)
- Importar componentes de `Select`

### O que NÃO muda
- Lógica de `owner_user_id` (consultores veem só suas tarefas)
- Filtros de status e busca existentes
- Ordenação, cards, navegação, EditarAcaoSheet

