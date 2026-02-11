

## Integração Google Sheets - Board Rúmina (aba contratosativos)

### Resumo

Criar uma edge function dedicada para ler dados da planilha Board Rumina, reutilizando a mesma lógica de autenticação JWT/RS256 já implementada em `google-sheets`, mas com credenciais e planilha próprias. Inclui cache em memória de 60 segundos para evitar excesso de chamadas à API do Google.

### 1. Novos Secrets

Dois novos secrets precisam ser criados:

- **GOOGLE_SHEET_KEY** - Chave da planilha Board Rumina (`1qJ1zZKPMdh24Rro7wKY9Mw6Cny3unaQgenr53EenwxI`)
- **GOOGLE_SERVICE_ACCOUNT_JSON** - JSON completo da service account `cs-sheet-rumina-data-board@rumina-data-board.iam.gserviceaccount.com` (já fornecido pelo usuário)

### 2. Nova Edge Function: `board-rumina`

**Arquivo:** `supabase/functions/board-rumina/index.ts`

Funcionalidades:
- Ação `clientes-ativos`: lê a aba `contratosativos` (range `contratosativos!A:ZZ`)
- Cache em memória de 60 segundos para evitar quota
- Tratamento de erros específicos (credencial inválida, aba inexistente, planilha não compartilhada)
- Retorno padronizado:

```text
{
  "success": true,
  "spreadsheetKey": "1qJ1z...",
  "sheet": "contratosativos",
  "headers": ["col1", "col2", ...],   // primeira linha
  "rows": [["val1", "val2", ...], ...], // demais linhas
  "rows_count": 150,
  "cached": false,
  "timestamp": "2026-02-11T..."
}
```

A lógica de JWT (base64url, importPrivateKey, createSignedJWT, getAccessToken) será copiada do `google-sheets/index.ts` existente, garantindo consistência.

### 3. Configuração

**Arquivo:** `supabase/config.toml` - adicionar:

```text
[functions.board-rumina]
verify_jwt = false
```

### 4. Detalhes Técnicos

```text
Fluxo:
  Request POST { action: "clientes-ativos" }
    -> Verificar cache (60s TTL)
    -> Se cache válido, retornar dados cacheados
    -> Senão:
      -> Ler GOOGLE_SERVICE_ACCOUNT_JSON (secret)
      -> Ler GOOGLE_SHEET_KEY (secret)
      -> Gerar JWT RS256 com service account
      -> Trocar JWT por access_token OAuth2
      -> GET sheets API v4: contratosativos!A:ZZ
      -> Separar headers (linha 1) dos dados
      -> Armazenar em cache
      -> Retornar JSON
```

**Tratamento de erros:**
- Secret não configurado -> 400 com mensagem clara
- Credencial inválida / OAuth falhou -> 500 "Erro de autenticação com Google"
- Planilha não compartilhada -> 403 com instrução para compartilhar
- Aba inexistente -> 404 "Aba 'contratosativos' não encontrada"

### 5. Arquivos Criados/Modificados

- `supabase/functions/board-rumina/index.ts` (novo)
- `supabase/config.toml` (adicionar entrada - automático)

Nenhuma alteração no banco de dados é necessária.

