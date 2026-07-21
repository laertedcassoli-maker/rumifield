## Objetivo
Remover exposição de credenciais Omie via body na Edge Function `test-omie-connection`, exigindo autenticação admin e lendo credenciais do banco.

## Mudanças

### 1. `supabase/config.toml`
Alterar bloco da função:
```toml
[functions.test-omie-connection]
verify_jwt = true
```

### 2. `supabase/functions/test-omie-connection/index.ts`
- Importar `corsHeaders` e `requireRole` de `../_shared/auth.ts` (remover const `corsHeaders` local para evitar duplicação).
- Após o preflight OPTIONS, chamar `await requireRole(req, ["admin"])`. Se `!ok`, retornar `auth.response`.
- Remover leitura de `app_key`/`app_secret` do `req.json()` (a função deixa de aceitar body).
- Criar client Supabase com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, buscar em `configuracoes` as chaves `omie_app_key` e `omie_app_secret` (mesmo padrão de `sync-omie-pecas`).
- Se credenciais ausentes, retornar 400 com mensagem clara (sem valores).
- Usar essas credenciais nos POSTs para `ListarProdutos` e `ListarEmpresas`. Manter resposta atual (`success`, `empresa`, `total_produtos`).
- Garantir que nenhum `console.log` imprima `app_key`/`app_secret` (o log atual da resposta `empresaData` está ok — não contém credenciais; manter substring).

### 3. `src/pages/admin/Config.tsx` (~linha 693)
- Ajustar a chamada `supabase.functions.invoke("test-omie-connection", …)` para não enviar `body` com credenciais. Chamar sem body (ou `body: {}`).
- Remover, se houver, coleta dos inputs de credenciais só para esse teste (manter os campos que salvam em `configuracoes`; o teste passa a usar o que estiver salvo).
- Ajustar mensagem/UX se o teste depender de credenciais salvas: se retornar 400 "não configuradas", orientar o admin a salvar antes de testar.

## Fora de escopo
- Não altero `sync-omie-pecas` nem outras funções.
- Não altero schema de `configuracoes`.
