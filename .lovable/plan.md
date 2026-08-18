# Corrigir aceite de convite ("Signups not allowed for this instance")

O cadastro público continua desabilitado. A criação da conta passa a acontecer no servidor, usando o token do convite como credencial.

## 1. Nova Edge Function `accept-invite`

`supabase/functions/accept-invite/index.ts`, rota pública (`verify_jwt = false` em `supabase/config.toml`), CORS/OPTIONS no mesmo padrão das funções existentes.

Recebe `{ token, password }` e, com a chave de serviço:

1. Busca o convite em `user_invites` pelo `token`.
2. Erros 400 com mensagem clara: convite inexistente, já usado (`used_at` preenchido), expirado (`expires_at < now`), senha com menos de 6 caracteres.
3. Cria o usuário via `auth.admin.createUser` com o e-mail do convite, `email_confirm: true` e `user_metadata: { nome }`.
4. E-mail já existente → 409 `{ error: "Email já cadastrado" }`.
5. Após criar, chama a função existente `accept_invite(_invite_id, _user_id, _role, _cidade_base)` com os dados do convite.
6. Sucesso → `{ success: true }`. Token e senha nunca aparecem na resposta nem em logs.

## 2. Ajuste em `src/pages/AceitarConvite.tsx`

- Substitui `signUp()` + `setTimeout(1500)` + `rpc('accept_invite')` por uma única chamada `supabase.functions.invoke('accept-invite', { body: { token, password } })`.
- Mantém validação zod, estados de loading/sucesso e redirecionamento para `/auth`.
- 409 → toast "Email já cadastrado" já existente; outros erros exibem a mensagem devolvida pela função.

## Fora de escopo

Nenhuma migration nova (`accept_invite` e `get_invite_by_token` já existem). Sem alterações em `src/components/ui/`, `src/pages/Auth.tsx`, `AuthContext` ou outras Edge Functions.
