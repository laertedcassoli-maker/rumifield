

## Atualizar tela Google Sheets Config para incluir Board Rumina

### Problema

A pagina `/admin/config/google-sheets` ainda chama apenas a edge function `google-sheets` (que usa os secrets `CREDENCIAL_GOOGLE` e `CHAVE_GOOGLE_SHEET_TABELA_BOARD`). Nao inclui nenhuma interacao com a nova edge function `board-rumina` (que usa `GOOGLE_SERVICE_ACCOUNT_JSON` e `GOOGLE_SHEET_KEY`).

### Solucao

Adicionar uma nova secao na pagina para testar e visualizar dados do Board Rumina, chamando a edge function `board-rumina` com `action: "clientes-ativos"`.

### Alteracoes no arquivo `src/pages/admin/GoogleSheetsConfig.tsx`

1. **Nova secao "Board Rumina - Contratos Ativos"** apos o card de conexao existente:
   - Botao "Carregar Contratos Ativos" que chama `supabase.functions.invoke("board-rumina", { body: { action: "clientes-ativos" } })`
   - Exibicao dos headers retornados como cabecalho da tabela
   - Tabela com os dados retornados (rows)
   - Badge indicando se veio do cache ou nao
   - Contador de linhas
   - Botao para copiar dados

2. **Novos estados**:
   - `boardRuminaStatus`: "idle" | "loading" | "loaded" | "error"
   - `boardRuminaData`: { headers, rows, rows_count, cached, timestamp }
   - Logs integrados ao mesmo sistema de logs existente

3. **Layout**: Card separado com titulo "Board Rumina - Contratos Ativos", descricao explicando que le a aba `contratosativos`, e tabela responsiva com scroll horizontal.

4. **Manter a secao existente** da integracao `google-sheets` intacta (conexao genérica e leitor de range).

### Detalhes Tecnicos

Nenhuma alteracao de banco de dados ou edge functions. Apenas o frontend `GoogleSheetsConfig.tsx` sera modificado para adicionar o novo card que chama `board-rumina`.

Estrutura do card:

```text
Card "Board Rumina - Contratos Ativos"
  -> Botao "Carregar Contratos Ativos"
  -> Badge com status (cache/fresh)
  -> Info: X linhas, timestamp
  -> Tabela com headers dinamicos + rows
  -> Botao Copiar
```

