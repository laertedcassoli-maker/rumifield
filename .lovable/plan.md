

## Adicionar campo de busca na tabela Board Rumina

### O que sera feito

Adicionar um campo de busca (Input) na secao "Board Rumina - Contratos Ativos" que filtra as linhas da tabela em tempo real conforme o usuario digita. A busca sera case-insensitive e procurara em todas as colunas de cada linha.

### Alteracoes em `src/pages/admin/GoogleSheetsConfig.tsx`

1. **Novo estado**: `boardRuminaSearch` (string) para armazenar o termo de busca.

2. **Logica de filtro**: Criar uma variavel `filteredRows` que filtra `boardRuminaData.rows` verificando se alguma celula da linha contem o termo de busca (case-insensitive).

3. **Campo de busca**: Adicionar um `Input` com icone de lupa ao lado dos botoes existentes ("Carregar" e "Copiar"), visivel apenas quando ha dados carregados.

4. **Tabela**: Renderizar `filteredRows` em vez de `boardRuminaData.rows`. Exibir contador mostrando "X de Y linhas" quando o filtro estiver ativo.

### Detalhes tecnicos

```text
Estado: boardRuminaSearch = ""

Filtro:
  filteredRows = boardRuminaData.rows.filter(row =>
    row.some(cell => cell.toLowerCase().includes(search.toLowerCase()))
  )

Layout:
  [Carregar] [Copiar] [Input busca com icone Search]
  Badge cache | "X de Y linhas"
  Tabela com filteredRows
```

Nenhuma alteracao em banco de dados ou edge functions.
