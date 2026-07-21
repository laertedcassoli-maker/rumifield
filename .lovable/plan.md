# Fix: `canAccess` inseguro durante loading

Hoje `canAccess` em `src/hooks/useMenuPermissions.ts` retorna `true` enquanto `permissions` ainda não carregou, o que revela temporariamente todos os menus antes de as permissões chegarem do backend. Vamos inverter o default e propagar o estado de loading para os consumidores.

## 1. `src/hooks/useMenuPermissions.ts`

- `canAccess(menuKey)`:
  - Se `permissionsLoading` (auth carregando ou query rodando ou `!permissions` com user ativo) → `return false`.
  - Depois de carregado, mantém a lógica atual: procura em `permissions`, e para chave não configurada mantém o fallback `role === 'admin'`.
- `canAccessAny` fica igual (usa `canAccess` internamente, então herda o novo default).
- `canEdit`, `canDelete`, `canEditFinalized` já retornam `false` no loading — não alterar.
- Nada muda nas regras/policies em si; só o comportamento no intervalo de carregamento.

## 2. Consumidores — evitar "flash" de menu

Todos já recebem `isLoading` (renomeando localmente para `permissionsLoading` quando útil) do hook.

- **`src/components/layout/AppSidebar.tsx`**
  - Já desestrutura `isLoading`. Enquanto `isLoading === true`, renderizar um skeleton dos grupos/itens (blocos `Skeleton` de `@/components/ui/skeleton` com a mesma altura dos `SidebarMenuButton`) em vez das listas filtradas por `canAccess`. Isso substitui o comportamento atual em que os `filter(item => canAccess(...))` retornavam todos os itens durante o loading.

- **`src/pages/Home.tsx`**
  - Desestruturar `isLoading` do hook. Enquanto `isLoading`, renderizar um grid de skeletons (mesma disposição atual dos cards de menu) no lugar de `mainMenuItems`/`estoqueMenuItems`/`oficinaMenuItems`/`adminMenuItems`. Sem loading a UI atual permanece.

- **`src/pages/oficina/GestaoOS.tsx`** (linhas 734–743)
  - Desestruturar `isLoading: permissionsLoading` do hook.
  - Enquanto `permissionsLoading`, mostrar um spinner centralizado (`Loader2 animate-spin` no mesmo container `flex items-center justify-center h-[60vh]`) em vez de renderizar imediatamente o "Você não tem permissão…". Só decidir o gate quando `!permissionsLoading`.

- **`src/pages/crm/CrmInteligencia.tsx`** (linha 135)
  - Local variable `isLoading` já é usada para o gateway; renomear a do hook para `permissionsLoading` para evitar colisão. Aplicar `canAccess("crm_inteligencia")` só quando `!permissionsLoading`; enquanto carrega, mostrar spinner/skeleton em vez de negar acesso.

Consumidores que só usam `canEdit`/`canDelete`/`canEditFinalized` (Chamados, Preventivas, Oficina/OrdensServico, DetalheOSDialog, ChecklistExecution) **não precisam de mudança** — esses helpers já retornam `false` no loading e nenhum deles depende de `canAccess`.

## 3. Regras que NÃO mudam

- Estrutura de `role_menu_permissions`, RLS, fallback admin para chaves não configuradas.
- Assinaturas dos helpers (`canAccess`, `canEdit`, etc.).
- Comportamento pós-loading permanece idêntico ao atual.

## Verificação

- Typecheck (`tsgo`) após as edições.
- Conferir manualmente: em cold reload, sidebar/Home/GestaoOS não devem "piscar" mostrando itens antes de sumir; deve aparecer skeleton/spinner até as permissões resolverem.
