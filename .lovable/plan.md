

## Corrigir "Acesso negado" quando offline

### Causa raiz
Quando offline, o `AuthContext` consegue recuperar a sessão do Supabase (cacheada em localStorage), mas as queries para `profiles` e `user_roles` **falham silenciosamente** por falta de rede. Resultado: `role` fica `null`, `isAdminOrCoordinator` é `false`, e se o usuário não é o técnico atribuído à rota, aparece "Acesso negado".

### Solução
Cachear `profile` e `role` em `localStorage` sempre que forem obtidos com sucesso. No `fetchUserData`, se a query falhar (offline), usar os valores cacheados como fallback.

### Mudanças em `src/contexts/AuthContext.tsx`

1. Após obter `profile` e `role` com sucesso do banco, salvar em `localStorage`:
   - `localStorage.setItem('cached_profile', JSON.stringify(profileData))`
   - `localStorage.setItem('cached_role', roleData.role)`

2. No `catch` do `fetchUserData`, tentar recuperar de `localStorage`:
   - `const cachedRole = localStorage.getItem('cached_role')`
   - `const cachedProfile = localStorage.getItem('cached_profile')`
   - Se existirem, usar `setRole(cachedRole)` e `setProfile(JSON.parse(cachedProfile))`

3. No `signOut`, limpar o cache:
   - `localStorage.removeItem('cached_profile')`
   - `localStorage.removeItem('cached_role')`

### Arquivos
- `src/contexts/AuthContext.tsx`

