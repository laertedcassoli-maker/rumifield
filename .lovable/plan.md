

## Plano

Inserir 7 usuários direto na tabela `profiles` + `user_roles` via insert tool (sem migração — é dados, não schema).

**Importante:** estes usuários ficarão pré-cadastrados no banco mas **ainda não terão `auth.users`** — isso só acontecerá quando cada um fizer o **primeiro login via Google**. O trigger `handle_new_user` cuidará de criar o profile vinculando pelo email. 

Mas aqui está o problema: o trigger faz `INSERT ... ON CONFLICT (id) DO NOTHING` usando o `NEW.id` do auth, e o profile pré-criado terá outro `id` (UUID novo). Resultado: dois profiles para o mesmo email, e o RPC `validate_rumina_login` que filtra por email vai funcionar, mas o app espera `profiles.id = auth.uid()`.

### Solução

Ajustar o trigger `handle_new_user` para:
1. Tentar localizar profile existente pelo email (case-insensitive)
2. Se existir → fazer `UPDATE` setando `id = NEW.id` (vincular ao auth user) e `is_active = true`
3. Se não existir → criar como hoje
4. Inserir role só se ainda não existir para o user

Isso permite pré-cadastrar usuários com nome+email+role e quando logarem via Google, o vínculo é automático.

### Passos

1. **Migração:** atualizar função `handle_new_user` com a lógica de vínculo por email.
2. **Insert tool:** inserir os 7 profiles (id gerado, is_active=true) + 7 user_roles (5 consultor_rplus + 2 coordenador_rplus).
3. Confirmar ao usuário que basta cada um logar com Google que o vínculo acontece automaticamente.

### Mapping
- Adriane, Ana Paula, Eduardo, Maria Laura, Tanaane → `consultor_rplus`
- Diana, Luis Flavio → `coordenador_rplus`

### Fora do escopo
- Não criar contas em `auth.users` (não há senha; primeiro login Google cria).
- Não enviar email de convite (login é Google direto).

