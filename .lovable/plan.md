## Exclusão de Visitas Preventivas e Corretivas

Adicionar exclusão (com confirmação) em 3 páginas, guardada por `canDelete` de `useMenuPermissions`.

### 1. `src/pages/preventivas/MinhasRotas.tsx`
- Importar `useMenuPermissions`, `Trash2`, componentes `AlertDialog*`, `useMutation`, `supabase`, `toast`.
- Derivar `canDeleteRoute = canDelete('minhas_rotas_listagem')`.
- Estado local `deleteTarget: { type: 'route'|'visit'; id: string; label: string } | null`.
- Duas mutations:
  - `deleteRouteMutation`: `DELETE FROM preventive_routes WHERE id=...`, invalida `['my-preventive-routes']`.
  - `deleteVisitMutation`: `DELETE FROM ticket_visits WHERE id=...`, invalida `['my-corrective-visits']`.
- `renderPreventiveCard`: dentro do card, ao lado do conteúdo do `<Link>`, adicionar botão fora do Link (wrapper `relative` no card; botão `absolute top-2 right-2` `variant="ghost"` `size="icon"` `text-destructive hover:text-destructive`) com `Trash2`. `onClick` faz `preventDefault/stopPropagation` e seta `deleteTarget` com o `route_code`. Só renderiza se `canDeleteRoute`.
- `renderCorrectiveCard`: idem, seta `deleteTarget` tipo `visit`.
- Um único `AlertDialog` no final controlado por `deleteTarget`:
  - Preventiva: título `Excluir rota {label}?`, desc "Esta ação não pode ser desfeita. Todos os dados da rota serão removidos."
  - Corretiva: título `Excluir visita corretiva?`, desc "Esta ação não pode ser desfeita."
  - `AlertDialogAction` chama a mutation correspondente; toast de sucesso/erro.

### 2. `src/pages/preventivas/ExecucaoRota.tsx`
- Importar `useMenuPermissions`, `useNavigate`, `Trash2`, `AlertDialog*`, `useMutation`, `supabase`, `toast`.
- `canDeleteRoute = canDelete('minhas_rotas_listagem')`.
- No cabeçalho de ações da página, adicionar botão "Excluir Rota" (`Trash2`, `variant="outline"` com `text-destructive`) visível só se `canDeleteRoute`.
- Estado `showDeleteDialog`; `AlertDialog` com título `Excluir rota {route_code}?` e desc "Esta ação não pode ser desfeita."
- Confirmar → `DELETE FROM preventive_routes WHERE id=:id` (do `useParams`); em sucesso: toast + `navigate('/minhas-rotas')`.

### 3. `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
- `useMenuPermissions` já importado. Adicionar `canDeleteVisit = canDelete('chamados_detalhe') || canDelete('chamados')`.
- No cabeçalho, ao lado do botão "Editar Visita", adicionar botão "Excluir Visita" (`Trash2`) condicional a `canDeleteVisit`.
- Estado `showDeleteDialog`; `AlertDialog` com título "Excluir esta visita corretiva?" e desc "Esta ação não pode ser desfeita."
- Confirmar → `DELETE FROM ticket_visits WHERE id=:id`. Em sucesso: toast + `navigate` para o chamado pai (usar `ticket_id` já carregado na página, ex.: `/chamados/{ticketId}`).

### Regras gerais
- Botão de exclusão é ocultado (não desabilitado) quando sem permissão.
- Cascade do banco cuida das dependências em `preventive_routes` e `ticket_visits`.
- Tratamento de erro: toast com mensagem do Supabase; fechar dialog em sucesso.
- Sem mudanças em lógica de execução/edição existente.

### Arquivos editados
- `src/pages/preventivas/MinhasRotas.tsx`
- `src/pages/preventivas/ExecucaoRota.tsx`
- `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
