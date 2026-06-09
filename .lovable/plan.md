## Objetivo
Propagar `permissionContext` via router `state` para que `ExecucaoRota` (preventiva) e `ExecucaoVisitaCorretiva` (corretiva) avaliem a permissão de exclusão segundo o módulo de origem.

## Mudanças

### 1. `src/pages/preventivas/MinhasRotas.tsx`
- Card preventivo (linha 595): adicionar `state={{ permissionContext: 'minhas_rotas_listagem' }}` no `<Link to={`/preventivas/execucao/${route.id}`}>`.
- Card corretivo (linha ~691): adicionar `state={{ permissionContext: 'minhas_rotas_listagem' }}` no `<Link to={`/chamados/visita/${visit.id}`}>`.

### 2. `src/pages/preventivas/AtendimentoPreventivo.tsx`
- Linha 358 — `navigate(`/preventivas/execucao/${routeId}`, { state: { permissionContext: 'minhas_rotas_listagem' } });`
- Linhas 673 e 701 — adicionar `state={{ permissionContext: 'minhas_rotas_listagem' }}` aos dois `<Link>`.

### 3. `src/pages/chamados/DetalheChamado.tsx`
- Linha ~766 — adicionar `state={{ permissionContext: 'chamados' }}` ao `<Link to={`/chamados/visita/${entry.visit_data.id}`}>`.

### 4. `src/pages/preventivas/ExecucaoRota.tsx`
- Linha 2 — adicionar `useLocation` ao import.
- Após `const navigate = useNavigate();` (linha 108):
  ```tsx
  const { state } = useLocation();
  const permissionContext = (state as { permissionContext?: string } | null)?.permissionContext ?? 'minhas_rotas_listagem';
  ```
- Linha 113 — substituir por `const canDeleteRoute = canDelete(permissionContext);`.

### 5. `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
- Linha 2 — adicionar `useLocation` ao import.
- Após `const navigate = useNavigate();` (linha 61):
  ```tsx
  const { state } = useLocation();
  const permissionContext = (state as { permissionContext?: string } | null)?.permissionContext ?? 'chamados';
  ```
- Linha 718 — substituir por `const canDeleteVisit = canDelete(permissionContext);`.

## Resultado
| Origem | Destino | permissionContext |
|---|---|---|
| MinhasRotas | ExecucaoRota | `minhas_rotas_listagem` |
| AtendimentoPreventivo | ExecucaoRota | `minhas_rotas_listagem` |
| MinhasRotas | ExecucaoVisitaCorretiva | `minhas_rotas_listagem` |
| DetalheChamado | ExecucaoVisitaCorretiva | `chamados` |
| URL direta | qualquer | fallback do módulo |

## Restrições
Nenhuma outra lógica é alterada (apenas o cálculo de `canDeleteRoute`/`canDeleteVisit` e o `state` dos links/navigate).