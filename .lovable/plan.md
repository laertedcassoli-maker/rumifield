## Objetivo
Propagar `permissionContext` do `ExecucaoRota` para `AtendimentoPreventivo` e adicionar exclusão de visita preventiva (item de rota) em `AtendimentoPreventivo`, respeitando o módulo de origem.

## Mudanças

### 1. `src/pages/preventivas/ExecucaoRota.tsx`
Nos `<Link>` para `/preventivas/execucao/${id}/atendimento/${item.id}` (linhas ~688 e ~699 — incluindo o "Ver resumo"), adicionar `state={{ permissionContext }}` para propagar o contexto já lido via `useLocation`.

### 2. `src/pages/preventivas/AtendimentoPreventivo.tsx`
- Import: adicionar `useLocation` ao import de `react-router-dom`; adicionar `Trash2` ao import de `lucide-react`; adicionar (se não houver) imports de `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` de `@/components/ui/alert-dialog`.
- Após o uso existente de `useMenuPermissions`, adicionar:
  ```tsx
  const { state } = useLocation();
  const permissionContext = (state as { permissionContext?: string } | null)?.permissionContext ?? 'minhas_rotas_listagem';
  const { canDelete } = useMenuPermissions();
  const canDeleteVisit = canDelete(permissionContext);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  ```
- Adicionar mutation `deleteVisitMutation` que deleta de `preventive_route_items` por `itemId`; em `onSuccess`, toast + `navigate(`/preventivas/execucao/${routeId}`, { state: { permissionContext } })`.
- No cabeçalho da página (sticky header onde já está o "Voltar"), adicionar botão `Excluir` (`variant="ghost"`, `size="sm"`, classe `text-destructive hover:text-destructive`) visível apenas se `canDeleteVisit`.
- Adicionar `AlertDialog` de confirmação com título "Excluir esta visita preventiva?" e botão destrutivo chamando `deleteVisitMutation.mutate()`.

## Restrições
- Não alterar nenhuma outra lógica da página.
- Permissão controlada pelo módulo de origem; URL direta cai no fallback `minhas_rotas_listagem`.