# Filtros Meu/Todos + Pendentes/Concluídos/Todos em Chamados

Replicar em `src/pages/chamados/Index.tsx` o padrão de filtros recém-entregue em Visita Técnica.

## Mudanças

### 1. Tipos e estados (topo do componente, ~linha 133)

```tsx
import { useSearchParams } from 'react-router-dom'; // estende import existente de react-router-dom

type OwnerFilter = 'meus' | 'todos';
type SituacaoFilter = 'pendentes' | 'concluidos' | 'todos';

const PENDENTE_STATUS = ['aberto', 'em_atendimento', 'aguardando_peca'];
```

Dentro do componente:

```tsx
const [searchParams] = useSearchParams();
const isTecnico = role === 'tecnico_campo' || role === 'tecnico_oficina';

const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(() =>
  searchParams.get('meu') === '1' || isTecnico ? 'meus' : 'todos',
);
const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilter>(() =>
  searchParams.get('status') === 'pendente' ? 'pendentes' : 'todos',
);
```

### 2. Filtro no useMemo `filteredTickets` (~linhas 265-302)

Adicionar dentro do `tickets.filter(...)`:

```tsx
if (ownerFilter === 'meus' && ticket.assigned_technician_id !== user?.id) return false;
if (situacaoFilter !== 'todos') {
  const concluido = ticket.status === 'resolvido' || ticket.status === 'cancelado';
  if (situacaoFilter === 'concluidos' && !concluido) return false;
  if (situacaoFilter === 'pendentes' && concluido) return false;
}
```

- Pendente = aberto / em_atendimento / aguardando_peca (ou seja, tudo que não é resolvido/cancelado — cancelados já excluídos já não existem na listagem, mas o mapeamento fica explícito).
- Deps do useMemo ganham `ownerFilter`, `situacaoFilter`, `user?.id`.

### 3. Linha de botões (entre os cards de estatística e a linha de filtros atual)

Mesmo JSX de VisitaTecnica.tsx (linhas 431-486 lá), com labels de chamados:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button variant={ownerFilter === 'meus' ? 'default' : 'outline'} size="sm"
    className="shrink-0 gap-1" onClick={() => { setOwnerFilter('meus'); setCurrentPage(1); }}>
    <User className="h-3 w-3" /> Meus
  </Button>
  <Button variant={ownerFilter === 'todos' ? 'default' : 'outline'} size="sm"
    className="shrink-0" onClick={() => { setOwnerFilter('todos'); setCurrentPage(1); }}>
    Todos os chamados
  </Button>
  <div className="flex items-center gap-2 sm:ml-auto">
    {(['pendentes', 'concluidos', 'todos'] as const).map(opt => (
      <Button key={opt} variant={situacaoFilter === opt ? 'default' : 'outline'} size="sm"
        className="shrink-0" onClick={() => { setSituacaoFilter(opt); setCurrentPage(1); }}>
        {opt === 'pendentes' ? 'Pendentes' : opt === 'concluidos' ? 'Concluídos' : 'Todos'}
      </Button>
    ))}
  </div>
</div>
```

Importar `User` de `lucide-react` (já importa vários ícones dali).

### 4. Intocado

- Os 5 cards de estatística, Select de status detalhado, busca, prioridade, cliente, período, colunas, ações, paginação e botão "Novo Chamado".
- `useMinhasPendencias.ts` / `MinhasPendencias.tsx` (a integração do link com `?meu=1&status=pendente` fica para o próximo prompt).

## Critérios de aceite

- Técnico (campo/oficina) entra em Chamados e já vê só os próprios ("Meus"); demais papéis veem "Todos" por padrão.
- Pendentes/Concluídos/Todos filtra corretamente (Concluído inclui resolvido e cancelado).
- `/chamados?meu=1&status=pendente` abre com os dois filtros aplicados.
- Nenhuma regressão nos filtros/tabela/paginação existentes.
