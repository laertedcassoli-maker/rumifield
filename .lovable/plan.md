# Ordens de Serviço: toggle Meu/Todos + entrada pré-filtrada de Minhas Pendências

Em `src/pages/oficina/OrdensServico.tsx`:

## Estado (linha 96-97)

- Adicionar `import { useSearchParams } from 'react-router-dom';` (o arquivo ainda não importa nada do router).
- Antes de `activeTab`:
  ```tsx
  const [searchParams] = useSearchParams();
  const [ownerFilter, setOwnerFilter] = useState<'meu' | 'todos'>(() =>
    searchParams.get('meu') === '1' || role === 'tecnico_oficina' ? 'meu' : 'todos',
  );
  ```
- Substituir a declaração atual:
  ```tsx
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get('status') === 'pendente' ? 'abertas' : 'kanban',
  );
  ```

## Filtro (`filteredOrders`, linha ~305, logo após `if (!matchesSearch) return false;`)

```tsx
if (ownerFilter === 'meu' && wo.assigned_to_user_id !== user?.id) return false;
```

## UI (linha de filtros, ~linha 470, antes do bloco "Criação:")

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground whitespace-nowrap">Responsável:</span>
  <div className="flex gap-1">
    <Button variant={ownerFilter === 'meu' ? 'default' : 'outline'} size="sm"
      onClick={() => setOwnerFilter('meu')} className="h-9 text-xs">Meu</Button>
    <Button variant={ownerFilter === 'todos' ? 'default' : 'outline'} size="sm"
      onClick={() => setOwnerFilter('todos')} className="h-9 text-xs">Todos</Button>
  </div>
</div>
```

(h-9 para alinhar com os Select/DateFilterButton da mesma linha)

## Intocado

- OSKanban.tsx, diálogos de Nova OS/Detalhe OS, exclusão, exportação.
- Filtros existentes (busca, datas, atividade, peça).
- Abas Kanban/Abertas/Concluídas — só ganham estado inicial via `?status=pendente`.

## Critérios de aceite

- `tecnico_oficina` abre em "Meu"; demais papéis em "Todos".
- `/oficina/os?meu=1&status=pendente` chega na aba "Abertas" com "Meu" ativo.
- "Todos" mostra tudo independente do responsável.
