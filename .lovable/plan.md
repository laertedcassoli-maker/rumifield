## Adicionar grupo "Minhas Rotas" na tela de Permissões

### Migration (já aplicada)
Inseridas 7 linhas em `role_menu_permissions` para `menu_key = 'minhas_rotas_listagem'` / `menu_group = 'minhas_rotas'` com defaults por perfil (admin total; coord. serviços edita; téc. campo só acessa; demais sem acesso).

### Edições em `src/pages/admin/Permissoes.tsx`
1. Importar `Route` de `lucide-react`.
2. Em `menuGroupConfig`: adicionar `minhas_rotas: { label: 'Minhas Rotas', icon: Route, order: 5 }`, mover `chamados` para `order: 6` e `admin` para `order: 7`.
3. Em `groupActionColumns`: adicionar `minhas_rotas` com as 3 colunas (`can_edit`, `can_delete`, `can_edit_finalized`).

Nenhuma alteração na entrada de nav `minhas_rotas` do grupo `principal`.