# Auditoria: migração de chaves JWT simétricas → assimétricas

Fiz a varredura completa do repositório antes de propor qualquer mudança. Resumo: **a migração é segura para este projeto**. Nada no código valida JWTs com o secret simétrico; tudo delega ao Supabase Auth ou ao JWKS.

## 1. Validação de JWT fora do Supabase Auth

**Não existe nenhum ponto no código que use `SUPABASE_JWT_SECRET` ou faça verificação manual de assinatura.**

Varreduras executadas em `supabase/` e `src/` pelos padrões: `SUPABASE_JWT_SECRET`, `JWT_SECRET`, `jwt.verify`, `verifyJWT`, `jsonwebtoken`, `jose`, `jwtVerify`, `decodeJwt`, `SUPABASE_JWKS` — **zero ocorrências em código de aplicação**. As únicas ocorrências são as flags `verify_jwt` de `supabase/config.toml` (plataforma, não código).

O segredo `SUPABASE_JWKS` está listado nos secrets do projeto, mas nenhum arquivo o lê. Pode continuar lá inofensivo.

## 2. Edge Functions — como autenticam hoje

Todas as funções com `verify_jwt = true` no `config.toml` (11 funções securizadas na última rodada) passam pelo helper único **`supabase/functions/_shared/auth.ts`**, que faz:

```ts
const client = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data, error } = await client.auth.getUser();
```

Isto é uma chamada **server-side ao GoTrue** (`/auth/v1/user`), que valida o token com as chaves ativas no próprio Supabase Auth. **Independe do algoritmo** (HS256, RS256 ou ES256) — o cliente não decodifica localmente. `requireRole` idem, apenas consulta `user_roles` depois. **Nada quebra.**

Além disso, a plataforma também valida `verify_jwt` no gateway antes de invocar a função, e essa validação também acompanha automaticamente as chaves ativas em Auth.

## 3. Função `mcp` especificamente

Definida em `src/lib/mcp/index.ts` usando `@lovable.dev/mcp-js`:

```ts
auth: auth.oauth.issuer({
  issuer: `https://${projectRef}.supabase.co/auth/v1`,
  acceptedAudiences: "authenticated",
})
```

O verificador do `mcp-js` **busca o JWKS público do issuer** (`/.well-known/jwks.json`) e valida a assinatura do bearer token localmente com a chave pública. Isso **exige** chave assimétrica: hoje o JWKS está vazio (HS256), então tokens OAuth emitidos ao Claude não passariam por esse verificador nem que `/oauth/token` conseguisse assiná-los.

Ou seja: a migração **não só não quebra o MCP como é pré-requisito para ele funcionar de ponta a ponta com clientes externos**.

## 4. Sessões ativas dos usuários

Tokens de sessão já emitidos (HS256) continuam válidos até expirarem — a tool `migrate_signing_keys` mantém a chave antiga em modo verify enquanto ativa a nova ES256 para assinatura. Nenhum logout forçado.

## Conclusão / recomendação

Nada precisa ser alterado no código antes de rodar a migração. Basta executar `supabase--migrate_signing_keys` (troca só o algoritmo de assinatura no backend, não toca em código). Depois disso:

- `/oauth/token` para de retornar 500 e passa a emitir ID tokens ES256.
- O verificador do `mcp` (`mcp-js` via JWKS) passa a validar os tokens do Claude.
- Todas as edge functions atuais seguem funcionando sem alteração.

Este plano é apenas o relatório da auditoria + a próxima ação (rodar `migrate_signing_keys`). Aprove para eu executar a migração.
