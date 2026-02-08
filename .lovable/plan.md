
## Navegacao contextual no botao Voltar da Visita CRM

### Problema

Hoje, o botao "Voltar" na tela de execucao de visita sempre redireciona para `/crm/visitas`. Quando o usuario acessa a visita a partir da tela do Cliente 360, ele espera voltar para la -- nao para a lista de visitas.

### Solucao

Usar o mesmo padrao ja implementado no `CrmCliente360.tsx`: passar o caminho de origem via `location.state` e usar esse valor no botao Voltar.

### Alteracoes

**1. `src/pages/crm/CrmCliente360.tsx`**

No `<Link>` que leva para a visita (linha ~284), passar o state com a rota de origem:

```tsx
<Link 
  to={`/crm/visitas/${v.id}`} 
  state={{ from: `/crm/${clientId}`, fromLabel: 'Cliente' }}
>
```

**2. `src/pages/crm/CrmVisitaExecucao.tsx`**

- Importar `useLocation` do react-router-dom
- Ler `location.state` para obter `from` (fallback: `/crm/visitas`)
- Usar esse valor no botao Voltar, no cancelamento e na finalizacao

Tres pontos de navegacao serao atualizados:
- Botao Voltar (seta no header)
- Callback de cancelamento (`cancelMutation.onSuccess`)
- Callback de finalizacao (`onFinalized`)

**3. `src/pages/crm/CrmVisitas.tsx`**

No card clicavel da lista de visitas, passar state indicando origem "Visitas":

```tsx
onClick={() => navigate(`/crm/visitas/${v.id}`, { state: { from: '/crm/visitas', fromLabel: 'Visitas' } })}
```

Isso garante consistencia: independente de onde o usuario veio, o botao Voltar sempre retorna ao ponto de origem correto.
