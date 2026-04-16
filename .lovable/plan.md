

Confirmação correta. Vou resumir e propor o plano enxuto.

## Estado atual confirmado

1. **`profiles`** já existe (id, nome, email, telefone, avatar_url, cidade_base, is_active) — vinculada a `auth.users`.
2. **`user_roles`** já existe com 7 roles (admin, coordenador_rplus, consultor_rplus, coordenador_servicos, coordenador_logistica, tecnico_campo, tecnico_oficina) + `has_role()`.
3. **Permissões de menu** já vêm de `role_menu_permissions` por role.
4. Hoje todos logam por **email/senha**.

## Proposta

Em vez de criar tabela `employees` nova (duplicaria `profiles`), **usar `profiles` como fonte de verdade** dos colaboradores autorizados. O fluxo Google OAuth passa a ser:

1. Usuário clica "Entrar com Google"
2. Google força contas `@rumina.com.br` (parâmetro `hd: 'rumina.com.br'`)
3. Validação dupla no callback: email termina em `@rumina.com.br` E existe em `profiles` com `is_active = true`
4. Se passar → entra. Se falhar → `signOut` + toast claro + log

## Plano

### 1. Banco
- **Nova tabela `access_logs`** (id, user_id nullable, email, event_type: `login|logout|login_denied|login_error`, reason, ip, user_agent, created_at) — RLS: só admin lê.
- **Nova RPC `validate_rumina_login(p_user_id, p_email)`** SECURITY DEFINER:
  - Confere domínio `@rumina.com.br` (case-insensitive)
  - Confere `profiles` com email correspondente e `is_active = true`
  - Retorna `{ allowed: bool, reason: text }`
- **Atualizar `handle_new_user`**: se email não for `@rumina.com.br`, ainda cria profile mas marca `is_active = false` (defesa adicional; primeira validação é no app).
- **Trigger no `auth.users`** já existe (`handle_new_user`) — apenas ajustar.

### 2. Configuração de Auth
- Habilitar provider Google em Lovable Cloud (managed OAuth, sem credenciais próprias).
- Manter email/senha habilitado por enquanto (não quebra ninguém). Tela `/auth` priorizará o botão Google.

### 3. Frontend
- **`src/integrations/lovable/`**: gerar via tool de Configure Social Login.
- **`src/pages/Auth.tsx`**: trocar UI — botão grande "Entrar com Google" no topo. Manter formulário email/senha colapsado em "Outras formas de entrar" (fallback para usuários antigos durante transição).
- **Callback handler em `Auth.tsx`**:
  - Detectar retorno do OAuth (URL hash/params)
  - Retry `getSession()` até 5x com backoff curto
  - Validar via RPC `validate_rumina_login`
  - Se reprovado: `signOut({ scope: 'local' })` + toast + insert em `access_logs` com `login_denied`
  - Se aprovado: insert `login` em `access_logs` + redirect `/`
- **`AuthContext.tsx`**: adicionar `isAdmin = role === 'admin'` (já tem o resto). No `signOut`, registrar `logout` em `access_logs`.
- **`vite.config.ts`**: adicionar `navigateFallbackDenylist: [/^\/~oauth/]` no workbox PWA (obrigatório para OAuth funcionar no PWA).

### 4. Tela admin (resposta direta à sua pergunta nº3)
Em `src/pages/admin/Usuarios.tsx` (já existe) — confirmar que mostra: nome, email, role, `is_active`, último login. Se faltar alguma coluna, adicionar. Você poderá ver tudo ali.

### 5. Memory
Criar `mem://auth/google-oauth-rumina` documentando: domínio restrito, validação dupla (domínio + profiles ativo), tabela access_logs, fluxo de bloqueio.

## Fora do escopo
- Não criar tabela `employees` (duplicaria `profiles`).
- Não trocar enum de roles (mantém os 7 atuais).
- Não remover email/senha agora (transição segura).
- Não mexer em convites existentes.

## Pós-deploy
- Você precisa **garantir que cada colaborador tenha email cadastrado em `profiles` igual ao do Google Workspace** (`@rumina.com.br`). Quem não estiver, não entra.
- Após validar que todos funcionam via Google, podemos remover o login email/senha em uma segunda etapa.

