

## Separar visualmente os blocos da OS

### Problema encontrado

Os blocos Item, Horimetro, Motor, Pecas Utilizadas e Observacoes estao todos dentro de um **wrapper div** (linha 889) que so tem classe de opacidade condicional mas **nenhum espacamento interno**. O `space-y-20` do container externo so separa esse wrapper inteiro dos outros blocos (Atividade, Tempo Total), mas nao separa os blocos **dentro** dele.

### Solucao

Adicionar `space-y-10` (40px) ao wrapper div da linha 889, para que os blocos internos fiquem separados entre si.

### Detalhe tecnico

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

**Linha 889** - Alterar de:
```typescript
<div className={workOrder.status === 'aguardando' && !activeTimeEntry ? 'opacity-40 pointer-events-none select-none' : ''}>
```

Para:
```typescript
<div className={`space-y-10 ${workOrder.status === 'aguardando' && !activeTimeEntry ? 'opacity-40 pointer-events-none select-none' : ''}`}>
```

Tambem reverter o `space-y-20` do container externo (linha 839) para `space-y-10`, mantendo tudo uniforme.

**Resumo das alteracoes:**
- Linha 839: `space-y-20` para `space-y-10`
- Linha 889: adicionar `space-y-10` ao wrapper interno

Isso garante 40px de espacamento entre **todos** os 6 blocos de forma consistente.
