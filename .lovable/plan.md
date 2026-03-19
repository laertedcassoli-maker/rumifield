

## Fix: Coordenadores não veem pedidos de outros usuários

### Problema
O estado `viewAll` começa como `false` para todos. Isso significa que coordenadores e admins só veem seus próprios pedidos ao abrir a tela, precisando manualmente ativar o toggle "Ver todos".

### Correção
Em `src/pages/Pedidos.tsx`, mudar o valor inicial de `viewAll` para `true` quando o usuário for admin ou coordenador:

```typescript
// Antes:
const [viewAll, setViewAll] = useState(false);

// Depois:
const [viewAll, setViewAll] = useState(false);
// + useEffect que seta viewAll = true quando isAdmin é calculado
```

Como `isAdmin` depende de `role` (que pode carregar após o render inicial), a forma mais segura é usar um `useEffect` que atualiza `viewAll` quando `isAdmin` muda para `true`:

```typescript
useEffect(() => {
  if (isAdmin) setViewAll(true);
}, [isAdmin]);
```

### Arquivo modificado
- `src/pages/Pedidos.tsx` — 1 linha adicionada

