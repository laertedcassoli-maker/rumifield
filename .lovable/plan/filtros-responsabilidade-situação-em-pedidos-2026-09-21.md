# Filtros Responsabilidade + Situação em Pedidos

Em `src/pages/Pedidos.tsx`, adicionar um toggle de responsável (técnico/CSM responsável, critério já usado em Minhas Pendências) e um filtro simplificado Pendentes/Concluídos/Todos — separados do toggle "Visualizar" (solicitante), que fica como está.

## Mudanças

### 1. Estados (junto dos demais, após `tipoSolicitacaoFilter` ~linha 424)

```tsx
const [responsavelFilter, setResponsavelFilter] = useState<'meus' | 'todos'>(() =>
  searchParams.get('meu') === '1' ? 'meus' : 'todos',
);
const [situacaoFilter, setSituacaoFilter] = useState<'pendentes' | 'concluidos' | 'todos'>(() =>
  searchParams.get('status') === 'pendente' ? 'pendentes' : 'todos',
);
```

`searchParams` já existe (~linha 422). Sem sincronização por useEffect — lidos só na montagem (mesmo padrão dos outros módulos).

### 2. Filtro em `filteredAndSortedPedidos` (~linhas 544-547)

Logo após `matchesOwner`:

```tsx
const matchesResponsavel = responsavelFilter === 'todos'
  || pedido.tecnico_responsavel_user_id === user?.id
  || pedido.csm_responsavel_user_id === user?.id;
const concluido = pedido.status === 'entregue';
const matchesSituacao = situacaoFilter === 'todos'
  || (situacaoFilter === 'concluidos' && concluido)
  || (situacaoFilter === 'pendentes' && !concluido);
```

- Incluir `matchesResponsavel && matchesSituacao` no `return` (~linha 547).
- Incluir `responsavelFilter`, `situacaoFilter` nas deps do useMemo (~linha 566).

Obs.: `pedido` é tipado com esses campos (linhas 64-65 do arquivo mostram que existem no tipo base; o filtro usa acesso direto como em `pendenciasVisiveis`, que já lê os mesmos campos).

### 3. UI (logo abaixo do bloco "Visualizar", ~linha 2415)

Dois blocos novos no mesmo estilo (exatamente o JSX do prompt):

- "Responsabilidade:" → botões "Todos" / "Sob minha responsabilidade".
- "Situação:" → botões "Pendentes" / "Concluídos" / "Todos".

Ambos `h-7 text-xs`, `flex-wrap`, `size="sm"`, com `setCurrentPage(1)`? — Pedidos usa paginação via `currentPage`, mas os filtros existentes do bloco não resetam página aqui (viewAll/solicitante não fazem); manter sem reset para não alterar comportamento existente, igual aos vizinhos.

### 4. Intocado

- `viewAll`/`solicitanteFilter` e seu significado (solicitante = quem criou).
- Aba "Pendentes" (status === 'pendente', coleta reversa), Kanban, diálogos de processar/concluir, filtros de status detalhado, tipo de envio, logística, data, busca, paginação.

## Critérios de aceite

- `/pedidos?tipo=envio&meu=1&status=pendente` (e com `tipo=coleta_reversa`) abre com "Sob minha responsabilidade" e "Pendentes" aplicados.
- Concluído = status `entregue`; todo o resto conta como Pendente.
- Os toggles novos combinam com os filtros existentes sem regressão (viewAll, solicitante, status, tipo, data, busca).
