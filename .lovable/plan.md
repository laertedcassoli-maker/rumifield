## Objetivo
Expandir o sistema de permissões de menu para suportar permissões granulares de ação (editar, deletar, editar finalizado) por módulo, além do já existente `can_access`.

## 1. Migration SQL
Criar nova migration em `supabase/migrations/` com:

- `ALTER TABLE role_menu_permissions` adicionando 3 colunas booleanas (`can_edit`, `can_delete`, `can_edit_finalized`), todas com `DEFAULT false NOT NULL`.
- `UPDATE`s populando defaults por perfil:
  - `admin` + `menu_group = 'chamados'` → todas true
  - `coordenador_servicos`, `coordenador_rplus` + `menu_group = 'chamados'` → só `can_edit = true`
  - `admin` (todos os menus) → `can_edit_finalized = true`
  - `coordenador_servicos` (todos os menus) → `can_edit_finalized = true`
  - `admin`, `coordenador_servicos` + `menu_group = 'oficina'` → `can_edit = true`
- Substituir a função `public.can_edit_completed_checklist(_user_id uuid)` para consultar a tabela `role_menu_permissions` via `user_roles`, retornando true se qualquer linha tiver `can_edit_finalized = true` para o role do usuário (em vez do hardcode atual de admin + email do Phelipe).

## 2. Hook `src/hooks/useMenuPermissions.ts`
- Expandir `MenuPermission` com `can_edit`, `can_delete`, `can_edit_finalized`.
- Atualizar o `select` da query para incluir as 3 novas colunas.
- Adicionar 3 funções auxiliares (`canEdit`, `canDelete`, `canEditFinalized`) com o mesmo padrão de fallback do `canAccess` (admin true quando não há linha configurada).
- Incluir as 3 funções no objeto retornado pelo hook.
- Remover o `// @ts-ignore` agora que os tipos serão regenerados após a migration.

## Escopo
- Apenas migration + hook conforme especificado.
- Nenhuma tela consumidora será alterada nesta etapa (`can_edit_completed_checklist` continua sendo a porta de entrada do gate de checklist finalizado, agora alimentada pela tabela).
- Sem mudanças em UI de admin de permissões nesta etapa.

## Observação técnica
A nova versão de `can_edit_completed_checklist` deixa de conceder acesso explícito ao Phelipe por email — esse acesso passa a depender de o role dele ter `can_edit_finalized = true` em alguma linha de `role_menu_permissions` (o que será verdade para admin/coordenador_servicos após os UPDATEs). Confirme se isso é o desejado antes de aprovar.
