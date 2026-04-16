

## Diagnóstico

Fluxo: criar chamado → `invalidateQueries(['technical-tickets'])` → `navigate('/chamados/:id')` → usuário aperta voltar do navegador/PWA → `/chamados`.

**Por que não aparece no celular:**
- `invalidateQueries` marca a query como stale, mas só refetcha automaticamente para queries com observers ativos. Como a tela `/chamados` foi desmontada após o `navigate`, não havia observer → ficou só "stale".
- Ao voltar via histórico, `ChamadosIndex` remonta. React Query, ao montar com cache stale, **deveria** refetch automaticamente — exceto se `refetchOnMount` foi desligado. Não foi, mas a query usa `staleTime: 30_000` e o `refetchOnWindowFocus: true` é o que salva no desktop (clicar na aba dispara focus).
- No PWA mobile, voltar via gesto/back **não dispara `visibilitychange`/`focus`** de forma confiável (a app já estava em foreground). Então: cache stale + sem trigger = lista antiga.

**Por que funciona no desktop:** o usuário provavelmente clica no link do menu (nova navegação programática) ou a aba ganha foco quando volta — disparando refetch.

## Plano

Forçar refetch ao montar `ChamadosIndex`, garantindo dados frescos sempre que o usuário volta para a lista — independente do trigger de focus.

### Edição em `src/pages/chamados/Index.tsx`

Na configuração do `useQuery`:
- Trocar `staleTime: 30_000` por `staleTime: 0` **ou** adicionar `refetchOnMount: 'always'`.
- Manter `refetchOnWindowFocus: true`.

Opção escolhida: `refetchOnMount: 'always'` (mais explícito, mantém staleTime para evitar refetches durante navegação dentro da própria tela).

```tsx
useQuery({
  queryKey: ['technical-tickets'],
  queryFn: ...,
  enabled: !!user,
  staleTime: 30_000,
  refetchOnMount: 'always',  // ← novo
  refetchOnWindowFocus: true,
})
```

### Por que essa solução
- Alinhada com `mem://architecture/online-first-corrective-visits-list` (lista corretivas usa `staleTime: 0, refetchOnMount` justamente para esse cenário mobile).
- Custo baixo: 1 refetch extra ao remontar a tela, irrelevante para uma lista paginada.
- Resolve também outros cenários (editar chamado em `/chamados/:id` e voltar).

### Fora do escopo
- Não mexer em `NovoChamado.tsx` — invalidate já está correto.
- Não trocar a navegação pós-criação (continua indo direto para o detalhe, comportamento desejado).
- Não alterar configuração global do QueryClient.

