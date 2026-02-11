

## Adicionar Filtro por CSM na pagina Visitas CRM

### Contexto

A pagina `CrmVisitas` ja busca o nome do consultor (CSM) via join `profiles:owner_user_id(nome)` e exibe "por {nome}" em cada card. O filtro por CSM sera visivel apenas para admins e coordenadores, pois consultores ja veem apenas seus proprios clientes/visitas.

### Alteracoes

**Arquivo: `src/pages/crm/CrmVisitas.tsx`**

1. **Nova query para listar consultores** (apenas quando `isAdmin`):
   - Buscar `profiles` com `id` e `nome` para popular o Select
   - Reutilizar o mesmo padrao do `usePipelineData`

2. **Novo estado `csmFilter`**:
   - Estado `useState<string>('all')` para armazenar o user_id selecionado

3. **Componente Select de filtro**:
   - Posicionado entre os cards de status e o campo de busca
   - Usando o componente `Select` do shadcn/ui ja existente no projeto
   - Opcoes: "Todos os CSMs" + lista de nomes
   - Visivel somente para admins/coordenadores

4. **Logica de filtragem**:
   - No `filteredVisitas`, adicionar filtro por `owner_user_id === csmFilter` quando nao for "all"

### Detalhes Tecnicos

```text
Fluxo de dados:
  profiles (query) --> Select options
  csmFilter state --> filteredVisitas (useMemo)
```

**Mudancas no codigo:**

- Importar `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` de `@/components/ui/select`
- Nova query:
  ```
  useQuery(['crm-consultores'], profiles.select('id, nome').order('nome'), enabled: isAdmin)
  ```
- No `filteredVisitas` useMemo, adicionar:
  ```
  if (csmFilter !== 'all') {
    result = result.filter(v => v.owner_user_id === csmFilter);
  }
  ```
- Renderizar o Select entre os status cards e o campo de busca, condicional a `isAdmin`

Nenhuma alteracao no banco de dados e necessaria.

