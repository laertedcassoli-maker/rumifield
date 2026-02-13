
## Corrigir Popover no Pipeline (evitar navegacao ao clicar no balao)

### Problema
O card inteiro esta dentro de um `<Link to={...}>`, que renderiza uma tag `<a>`. Quando o usuario clica no botao do balao, o `stopPropagation()` impede a propagacao do evento React, mas a tag `<a>` nativa do browser ainda captura o clique e navega. Isso faz com que o Popover abra por um instante e imediatamente o usuario seja redirecionado.

### Solucao
Substituir o `<Link>` por um `<div>` com `onClick` programatico usando `useNavigate`. Dessa forma, o `stopPropagation()` no botao do Popover efetivamente impede que o click chegue ao `<div>` pai, e a navegacao nao acontece.

### Detalhes Tecnicos

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

1. Adicionar `useNavigate` (importar de `react-router-dom`)
2. Substituir o `<Link>` que envolve cada card por um `<div>`:

Antes:
```tsx
<Link key={p.id} to={`/crm/${p.client_id}`} state={{ from: '/crm/pipeline', fromLabel: 'Pipeline' }}>
  <Card ...>
    ...
  </Card>
</Link>
```

Depois:
```tsx
<div
  key={p.id}
  onClick={() => navigate(`/crm/${p.client_id}`, { state: { from: '/crm/pipeline', fromLabel: 'Pipeline' } })}
  className="cursor-pointer"
>
  <Card ...>
    ...
  </Card>
</div>
```

3. O `stopPropagation()` no botao do Popover ja existe e agora funcionara corretamente, pois o evento nao vai propagar ate o `<div>` pai
4. O `stopPropagation()` no `PopoverContent` tambem continua, impedindo que cliques dentro do popover naveguem

### Por que funciona
- Com `<Link>` (tag `<a>`), o browser tem comportamento nativo de navegacao que nao e bloqueado por `stopPropagation` do React
- Com `<div>` + `onClick` programatico, tudo e controlado pelo React, e `stopPropagation` funciona como esperado
