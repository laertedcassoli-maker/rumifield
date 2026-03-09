

## Corrigir "Nenhuma rota atribuída" offline — closures obsoletas no useOfflineQuery

### Problema raiz

O `useEffect` que chama `offlineFn` no `useOfflineQuery` **não inclui `offlineFn` nas dependências**. Quando o componente monta offline:

1. Primeiro render: `user = null`, `enabled = false` → effect roda mas `shouldFallback = false` → nada acontece
2. Auth carrega (localStorage): `user` existe, `enabled = true` → deps mudam → effect re-roda
3. Mas `offlineFn` capturada pode estar com closure obsoleta OU o efeito pode rodar antes do `role` estar disponível

O resultado: `offlineFn` retorna `[]` e nunca é re-executada, mesmo quando todos os dados ficam disponíveis.

### Solução

Refatorar `useOfflineQuery` para usar `useRef` no `offlineFn`, garantindo que sempre usa a versão mais recente da closure:

**Arquivo: `src/hooks/useOfflineQuery.ts`**

```typescript
const offlineFnRef = useRef(offlineFn);
offlineFnRef.current = offlineFn; // Sempre atualizado

useEffect(() => {
  if (shouldFallback) {
    setOfflineLoading(true);
    offlineFnRef.current()  // Usa ref, não closure
      .then(...)
  }
}, [shouldFallback, offlineRefetchKey]); // shouldFallback como dep
```

Mudanças:
1. Guardar `offlineFn` em `useRef` — sempre usa a versão mais atual
2. Usar `shouldFallback` diretamente como dependência do `useEffect` (é derivado de `isOnline`, `query.isError`, `query.isLoading`, `enabled`)
3. Isso garante que quando `enabled` muda (user carrega), `shouldFallback` muda, o efeito re-roda, e usa o `offlineFn` mais recente com o `user.id` correto

### Arquivo alterado
- `src/hooks/useOfflineQuery.ts` — useRef para offlineFn + deps corrigidas

