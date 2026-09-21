# Instalações: toggle Meu/Todos por responsável de etapa

Em `src/pages/instalacoes/Index.tsx`:

## Estado (após `filtroSituacao`, ~linha 103)

```tsx
const podeAlternarEscopo = !isTecnicoCampo;
const [ownerFilter, setOwnerFilter] = useState<'meu' | 'todos'>(() =>
  searchParams.get('meu') === '1' || role === 'tecnico_oficina' ? 'meu' : 'todos',
);
```

`searchParams` e `role`/`isTecnicoCampo` já existem (linhas 89-94).

## Filtro (dentro do useMemo `visibleInstallations`, após o bloco de `filtroSituacao`, antes do `.map()` final, ~linha 178)

```tsx
if (podeAlternarEscopo && ownerFilter === 'meu') {
  list = list.filter(inst =>
    inst.stages.some(s => s.technician_user_id === user?.id || s.csm_user_id === user?.id)
  );
}
```

- Deps do useMemo ganham `ownerFilter`, `podeAlternarEscopo`, `user?.id`.
- Instalações sem nenhuma etapa ficam fora do escopo "Meu" (não há etapa responsável) — coerente com o critério.

## UI (logo acima/ao lado dos cartões de resumo, dentro do bloco existente `flex flex-wrap gap-2` da linha ~439, antes dos cartões ou logo após — mesma fileira, só visível quando `podeAlternarEscopo`)

Dois botões "Meu" / "Todos" no mesmo estilo `h-auto rounded-full gap-1.5 px-3 py-1 text-xs` dos cartões de resumo (`variant="default"` no ativo, `outline` no inativo).

## Intocado

- Consulta/restrição de `tecnico_campo` (queryKey e recorte por stages) — sem toggle para esse papel.
- Cartões de resumo (`filtroSituacao`) — único filtro de situação; o resumo continua calculado sobre `installations` completo, ignorando o escopo Meu/Todos.
- `etapaFiltro`, diálogos de criar/configurar etapa, exclusão, upload de anexo.

## Critérios de aceite

- Admin/coordenador_servicos/coordenador_rplus/consultor_rplus abrem em "Todos" e podem alternar para "Meu".
- `tecnico_oficina` abre em "Meu" por padrão, com toggle disponível.
- `tecnico_campo` não vê o toggle (comportamento de hoje).
- `/instalacoes?meu=1` força "Meu" nos papéis com toggle.
