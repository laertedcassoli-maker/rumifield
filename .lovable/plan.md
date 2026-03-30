

## Limpar rota duplicada + prevenir duplicatas futuras

### 1. Excluir a rota duplicada (via insert tool)

A primeira PREV-2026-00003 (`7dd16f01-...`, 3 fazendas) será excluída. A segunda (`982a5d51-...`, 4 fazendas) será mantida.

```sql
DELETE FROM preventive_route_items WHERE route_id = '7dd16f01-55c3-44c1-9f1b-a08035076e3a';
DELETE FROM preventive_routes WHERE id = '7dd16f01-55c3-44c1-9f1b-a08035076e3a';
```

### 2. Adicionar constraint UNIQUE na coluna `route_code` (migration)

```sql
ALTER TABLE public.preventive_routes
ADD CONSTRAINT preventive_routes_route_code_unique UNIQUE (route_code);
```

Isso impede duplicatas a nível de banco, independente de race conditions no frontend.

### 3. Proteção no frontend — NovaRota.tsx

Atualmente o código gera o `route_code` no cliente (query + incremento). Se dois usuários abrem a tela ao mesmo tempo, ambos obtêm o mesmo código.

Alterar o `handleSubmit` para usar a função `generate_preventive_route_code()` do banco (via `rpc`) no momento do insert, em vez de usar o código gerado previamente no estado do form. O campo continua exibindo o código sugerido, mas o valor real vem do banco no momento da gravação.

```ts
// No handleSubmit, antes do insert:
const { data: codeData } = await supabase.rpc('generate_preventive_route_code');
const finalCode = codeData || form.route_code;

// Usar finalCode no insert
```

Se o insert falhar por constraint unique (race condition), exibir toast de erro claro.

### Resumo
- 1 exclusão de dados (rota duplicada)
- 1 migration (UNIQUE constraint)
- 1 arquivo alterado: `NovaRota.tsx` (usar RPC para código final)

