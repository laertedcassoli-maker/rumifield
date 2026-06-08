## Objetivo

Em `src/pages/preventivas/DetalheRota.tsx`, gatear os botões existentes de editar e excluir rota pelas permissões dinâmicas de `minhas_rotas_listagem`, seguindo o padrão de `src/pages/chamados/DetalheChamado.tsx`.

## Mudanças em `src/pages/preventivas/DetalheRota.tsx`

1. **Importar o hook** `useMenuPermissions` (caminho `@/hooks/useMenuPermissions`).

2. **Dentro do componente**, logo após os hooks existentes, adicionar:
   ```ts
   const { canEdit, canDelete } = useMenuPermissions();
   const canEditRoute = canEdit('minhas_rotas_listagem');
   const canDeleteRoute = canDelete('minhas_rotas_listagem');
   ```

3. **Gatear edição** (linha 589) — manter a regra de status `em_elaboracao` e a regra de papel, e adicionar `canEditRoute`:
   ```ts
   const isEditable = route.status === 'em_elaboracao' && isAdminOrCoordinator && canEditRoute;
   ```
   Isso já oculta/desabilita automaticamente toda a UI de edição existente que depende de `isEditable` (adicionar fazendas, remover itens, trocar template, etc., nas linhas 666, 724, 794, 818, 832, 838, 844, 884).

4. **Gatear o botão excluir** (linhas 636–656) — envolver o `<AlertDialog>` da lixeira numa condicional `canDeleteRoute &&`, mantendo também o gate atual `isAdminOrCoordinator`. Resultado: o botão `Trash2` só aparece quando `isAdminOrCoordinator && canDeleteRoute`.

## Fora do escopo

- Nenhum botão novo será criado.
- `MinhasRotas.tsx` não será alterado (não possui ações de editar/excluir).
- Botões de transição de status (Finalizar Planejamento / Iniciar Execução / Finalizar Rota) permanecem inalterados — não são "editar" nem "excluir".
