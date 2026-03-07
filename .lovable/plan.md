

## Problema identificado

Existem **dois bugs** causando o comportamento:

1. **Bypass de admin no código**: Em `useMenuPermissions.ts`, a função `canAccess` tem a linha `if (role === 'admin') return true;` que ignora completamente as permissões do banco para administradores. Mesmo desabilitando no banco, o menu continua visível.

2. **Permissões voltam ativas**: Provavelmente o toggle funciona (grava `false` no banco), mas como o admin bypass retorna `true` antes de consultar, o menu nunca some. Ao recarregar a página de Permissões, os dados do banco são lidos corretamente (mostram desabilitado), mas o sidebar ignora.

Confirmei no banco: todas as permissões de estoque para admin estão `can_access: true` neste momento.

## Plano

### 1. Remover o bypass incondicional de admin em `useMenuPermissions.ts`

Alterar a função `canAccess` para respeitar as permissões do banco para **todos** os perfis, incluindo admin. O fallback quando não há permissão cadastrada continuará `true` para admin (para não quebrar menus novos que ainda não tenham registro na tabela), mas quando há um registro explícito com `can_access: false`, ele será respeitado.

```typescript
const canAccess = (menuKey: string): boolean => {
  if (!permissions) return true; // Default while loading
  const perm = permissions.find(p => p.menu_key === menuKey);
  if (!perm) return role === 'admin'; // Admin: true for unconfigured menus
  return perm.can_access;
};
```

### Detalhes técnicos
- Arquivo: `src/hooks/useMenuPermissions.ts`
- Apenas a função `canAccess` é alterada (3 linhas)
- Nenhuma migração de banco necessária
- A página de Permissões (`Permissoes.tsx`) já funciona corretamente para gravar/ler

