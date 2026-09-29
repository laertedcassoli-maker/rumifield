# Kanban de Pedidos controlado pela tela de Permissões

## O que conferi antes
- `Pedidos.tsx` (linha 252): `canManagePedidos` é fixo em admin / coordenador_logistica / coordenador_servicos.
- A regra do banco "Admins and coordinators can update pedidos" usa hoje `is_admin_or_coordinator(auth.uid())`, que inclui **também o Coordenador R+** (admin, coordenador_rplus, coordenador_servicos, coordenador_logistica). Não tem WITH CHECK.
- Em `role_menu_permissions`, `can_edit` está **false para todos os 8 papéis** nas chaves `pedidos_envios` e `pedidos_coleta_reversa`.
- A tela de Permissões **não mostra a coluna "Editar"** no grupo "Solicitação de Peças" (hoje só aparecem Acesso e Exportar). Sem isso não dá para marcar/desmarcar pela tela.
- As outras regras de UPDATE de pedidos são "Responsaveis can update assigned pedidos" e "Users can update their own pedidos" (não "Tecnico can manage own..." / "Admin/Gestor..." como no texto). Ficam intocadas.

## Passos
1. **Dados (antes de tudo):** `can_edit = true` em `pedidos_envios` e `pedidos_coleta_reversa` para admin, coordenador_logistica, coordenador_servicos **e coordenador_rplus** (este último para não perder a permissão de atualizar que já tem no banco hoje — ver ponto de atenção).
2. **Função** `can_manage_pedidos(_user_id)` SECURITY DEFINER, search_path public: admin OU algum papel do usuário com `can_edit = true` numa das duas chaves.
3. **Regra do banco:** recriar "Admins and coordinators can update pedidos" FOR UPDATE com `USING (can_manage_pedidos(auth.uid()))`, sem WITH CHECK (como hoje).
4. **Pedidos.tsx:** `canManagePedidos = canEdit('pedidos_envios') || canEdit('pedidos_coleta_reversa')` via `useMenuPermissions()`. `canDeleteAnyPedido` e regras de exclusão intocados.
5. **Tela de Permissões:** adicionar a coluna "Editar" ao grupo `pedidos`, para poder ligar/desligar por papel.
6. **Teste:** entrar como admin/coord. logística/serviços e Processar um pedido; ligar "Editar" para Técnico de Oficina e Processar de verdade com essa conta; desligar e confirmar bloqueio na tela e no banco.

## Ponto de atenção
O Coordenador R+ hoje não vê o Kanban na tela, mas o banco deixa ele atualizar pedidos. No passo 1 mantenho isso marcando "Editar" para ele — o efeito colateral é que ele **passa a ver o Kanban**. Se preferir tirar esse acesso dele, é só não marcar (ele perde a permissão de atualizar no banco). Diga qual prefere; por padrão sigo mantendo.

Nada será publicado.
