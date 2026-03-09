

## Problema

A variável `isAdmin` em `src/pages/oficina/ItensOficina.tsx` (linha 86) controla a exibição do botão "Novo Ativo" e outras ações de gestão, mas não inclui `coordenador_logistica`. O banco de dados já permite via `is_admin_or_coordinator`, mas a UI esconde o botão.

## Correção

**Arquivo:** `src/pages/oficina/ItensOficina.tsx` (linha 86)

Adicionar `coordenador_logistica` à verificação:

```typescript
const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos' || role === 'coordenador_logistica';
```

**Escopo:** 1 linha alterada em 1 arquivo.

