

## Adicionar Filtro por Produto e Corrigir Filtro de Consultores

### O que sera feito

**1. Adicionar filtro por produto no Pipeline**
- Novo Select com opcoes: "Todos produtos", Ideagri, RumiFlow, OnFarm, RumiAction, RumiProcare
- Aplicado sobre as oportunidades ja filtradas por consultor
- Visivel para todos os usuarios (consultores e admins)

**2. Corrigir lista de consultores no filtro**
- Atualmente a query traz todos os profiles (`SELECT id, nome FROM profiles`)
- Sera corrigida para trazer apenas usuarios com role `consultor_rplus` (via join com `user_roles`)
- O filtro continua visivel apenas para admin e coordenador_rplus

### Detalhes Tecnicos

**`src/pages/crm/CrmPipeline.tsx`**
- Adicionar state `selectedProduct` (default: `'all'`)
- Importar `PRODUCT_LABELS` e `PRODUCT_ORDER` do hook
- Adicionar Select de produto na area de filtros (ao lado do filtro de consultor)
- Aplicar filtro de produto no `useMemo` de `filtered`

**`src/hooks/useCrmData.ts`** (funcao `usePipelineData`)
- Alterar query de consultores para fazer join com `user_roles` e filtrar por `role = 'consultor_rplus'`
- Exemplo: `supabase.from('user_roles').select('user_id, profiles!inner(id, nome)').eq('role', 'consultor_rplus')`
- Ajustar o mapeamento do retorno para manter o formato `{ id, nome }`

### Arquivos a modificar
- `src/pages/crm/CrmPipeline.tsx` - adicionar filtro de produto
- `src/hooks/useCrmData.ts` - corrigir query de consultores

