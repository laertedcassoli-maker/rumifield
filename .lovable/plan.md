# Filtro por produto ativo na Carteira CRM

## Contexto (verificado)
- `src/pages/crm/CrmCarteira.tsx` já calcula `activeProducts` por cliente (linhas 42-44: produtos com `stage === 'ganho'`), e esse array já vem no objeto usado pela lista (`clienteData`).
- `PRODUCT_ORDER` e `PRODUCT_LABELS` já são importados de `@/hooks/useCrmData`.
- A tela já tem dois filtros: busca por texto e Select de consultor (admin), no padrão shadcn `Select` (`h-9 text-sm`).

## Mudança (somente `src/pages/crm/CrmCarteira.tsx`)

1. **Estado**: `const [produtoFilter, setProdutoFilter] = useState<string>('todos');`

2. **UI**: novo Select de produto, mesmo padrão visual do Select de consultor (mesma classe `h-9 text-sm`), renderizado para todos os usuários (não só admin), posicionado logo abaixo do Select de consultor (ou no lugar dele quando o usuário não é admin). Opções:
   - `todos` → "Todos os produtos"
   - Um item por valor de `PRODUCT_ORDER`, com rótulo `PRODUCT_LABELS[code]`.

3. **Filtro**: dentro do `useMemo` `filtered`, quando `produtoFilter !== 'todos'`, filtrar `list = list.filter(c => c.activeProducts.includes(produtoFilter as ProductCode))` — combinando com os filtros de consultor e busca já existentes.

## O que não muda
- Cálculo de `activeProducts`, health, contadores, badges, navegação — nada é tocado.
- Busca e filtro de consultor permanecem idênticos.
- Sem migration, sem alteração de dados; tudo client-side sobre dados já carregados.

## Aceite
- Selecionar "RumiFlow" mostra só clientes com RumiFlow ativo (badge ativo no card); idem para os outros 4 produtos.
- Com "Todos os produtos", a lista fica exatamente como hoje.
- Filtro combina com busca e consultor; a contagem "X de Y clientes" reflete o resultado.
