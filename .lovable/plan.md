# Treinamento → Treinamentos + toggle Meu/Todos

## Renomeações

1. `src/components/layout/AppSidebar.tsx` (linha 49): `title: 'Treinamento'` → `title: 'Treinamentos'` (URL e permKey `treinamento` ficam iguais).
2. `src/pages/treinamento/Treinamento.tsx` (linha 290): `<h1 ...>Treinamento</h1>` → `<h1 ...>Treinamentos</h1>`.

## Toggle Meu/Todos em Treinamento.tsx

- Import: `useSearchParams` de `react-router-dom`; no componente: `const [searchParams] = useSearchParams();`.
- Após `role` (linha 99):
  ```tsx
  const isTecnico = role === 'tecnico_campo' || role === 'tecnico_oficina';
  const [ownerFilter, setOwnerFilter] = useState<'meu' | 'todos'>(() =>
    searchParams.get('meu') === '1' || isTecnico ? 'meu' : 'todos',
  );
  ```
- `lista` (linha 137) passa a aplicar o filtro:
  ```tsx
  const lista = useMemo(() => {
    const base = visitas ?? [];
    if (ownerFilter === 'todos') return base;
    return base.filter(v => v.technician_user_id === user?.id || v.csm_user_id === user?.id);
  }, [visitas, ownerFilter, user?.id]);
  ```
- Como `clienteIds`, `responsavelIds`, `filtradas`, `stats` e `clientesResumo` já derivam de `lista`, as duas abas e os cards refletem o filtro automaticamente.

## UI

- Botões "Meu" / "Todos" (estilo `h-7 text-xs`, `variant="default"` no ativo / `outline`), visível para qualquer papel, posicionado junto aos cards Todos/Concluídos/Pendentes (linha ~310), com label "Responsável:" no padrão dos outros módulos.

## Intocado

- NovaVisitaTreinamentoDialog.tsx, TrainingChecklistExecution.tsx, CombinarTreinamentoSection.tsx, os 3 pontos de integração, permKey/role_menu_permissions.
- Cards Todos/Concluídos/Pendentes e busca (complementares).
- Nome da tabela `training_visits` e rota `/treinamento`.

## Critérios de aceite

- Menu e título mostram "Treinamentos".
- Técnico (campo/oficina) abre em "Meu"; demais papéis em "Todos".
- Alternar filtra as duas abas; `/treinamento?meu=1` chega com "Meu" ativo.
