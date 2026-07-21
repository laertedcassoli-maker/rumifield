Refatorar o fluxo de login por senha para centralizar validação e auditoria no `AuthContext`, sem alterar a assinatura de `logAccess` nem o comportamento de logout.

### Alterações previstas

1. **`src/contexts/AuthContext.tsx`**
   - Manter a função `logAccess` exatamente como está (mesma assinatura, mesmos campos).
   - Transformar `signIn` no ponto único de validação e auditoria para login por senha:
     1. Normalizar o email (`trim().toLowerCase()`).
     2. Verificar domínio `@rumina.com.br`. Se for inválido, chamar `logAccess('login_denied', email, null, 'Domínio não autorizado')` e retornar um erro.
     3. Chamar `supabase.auth.signInWithPassword({ email, password })`.
     4. Em caso de erro de credencial, chamar `logAccess('login_error', email, null, error.message)` e retornar o erro.
     5. Em caso de sucesso, chamar a RPC `validate_rumina_login` com o `user.id` e email.
     6. Se a RPC negar o acesso, chamar `logAccess('login_denied', email, user.id, reason)`, fazer `signOut({ scope: 'local' })` e retornar um erro.
     7. Se a RPC aprovar, chamar `logAccess('login', email, user.id, 'password')` e retornar sucesso.
   - Garantir que a senha nunca seja logada, armazenada ou passada para `logAccess`.
   - Não alterar `signOut` nem `signUp`.

2. **`src/pages/Auth.tsx`**
   - Simplificar o `handleLogin` para usar o `signIn` já enriquecido do contexto.
   - Remover a validação de domínio duplicada, a chamada duplicada à RPC `validate_rumina_login` e os `logAccess` redundantes.
   - Manter o feedback visual (toast) e o controle de carregamento (`isSubmitting`).
   - Preservar o fluxo OAuth (Google) como está, pois ele já possui sua própria validação e logging.

### Critérios de aceitação

- Login com credenciais corretas e domínio válido registra `event_type = 'login'` em `access_logs`.
- Login com credenciais incorretas registra `event_type = 'login_error'`.
- Login com domínio não autorizado registra `event_type = 'login_denied'`.
- Login aprovado pelo Supabase mas negado pela allowlist registra `event_type = 'login_denied'` com `user_id` preenchido.
- Logout continua registrando `event_type = 'logout'`.
- Nenhuma senha aparece em logs, payloads ou chamadas.
- Typecheck e build passam sem regressões.