# Submenu "Solicitação de Peças" (Envios / Coleta Reversa)

## 1. Menu lateral (`src/components/layout/AppSidebar.tsx`)
- Remover `{ title: 'Solicitação de Peças', ... permKey: 'pedidos' }` de `mainMenuItems` (linha ~39).
- Criar, junto aos demais grupos (~linha 95):
  - `pedidosItems = [ { title: 'Envios', icon: Truck, url: '/pedidos?tipo=envio', permKey: 'pedidos_envios' }, { title: 'Coleta Reversa', icon: RefreshCcw, url: '/pedidos?tipo=coleta_reversa', permKey: 'pedidos_coleta_reversa' } ].filter(item => canAccess(item.permKey))`
  - `showPedidosMenu = canAccess('pedidos') && pedidosItems.length > 0`
  - `isPedidosActive = location.pathname === '/pedidos'`
- Renderizar o `Collapsible` logo após o `.map()` de `mainMenuItems` (antes do bloco CRM), exatamente no padrão de "Estoque Químicos": `CollapsibleTrigger asChild` + `SidebarMenuButton isActive={isPedidosActive}` com ícone `ShoppingCart`, `<span>Solicitação de Peças</span>` e `ChevronDown`; filhos em `SidebarMenuSub` com `SidebarMenuSubButton asChild isActive={location.pathname + location.search === item.url}` (mesmo padrão já usado nos submenus com querystring do arquivo).
- Importar `RefreshCcw` do lucide-react.

## 2. Filtro inicial pela URL (`src/pages/Pedidos.tsx`)
- Importar `useSearchParams` do `react-router-dom` (mesmo padrão de `MinhasRotas.tsx`).
- Antes do estado do filtro: `const [searchParams] = useSearchParams();`
- Inicializar o estado (linha ~173) de forma lazy, uma única vez:
  `useState<'all'|'envio'|'coleta_reversa'>(() => { const t = searchParams.get('tipo'); return t === 'envio' || t === 'coleta_reversa' ? t : 'all'; })`
- Nada mais muda: sem `useEffect` de sincronização, sem travas, sem alterar os botões, a aba "Rascunhos" ou `activeTab`.

## 3. Migration (dados apenas)
Nova migration em `supabase/migrations/` inserindo em `role_menu_permissions`, para cada role, uma linha por novo `menu_key`, derivada da linha de `'pedidos'`:

```sql
INSERT INTO public.role_menu_permissions
  (role, menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized, can_export)
SELECT role, 'pedidos_envios', 'Envios', 'pedidos', can_access, can_edit, can_delete, can_edit_finalized, can_export
FROM public.role_menu_permissions WHERE menu_key = 'pedidos'
ON CONFLICT (role, menu_key) DO UPDATE SET menu_label = EXCLUDED.menu_label, menu_group = EXCLUDED.menu_group, updated_at = now();
```
(idem para `'pedidos_coleta_reversa'` / rótulo 'Coleta Reversa'). A linha `'pedidos'` permanece intocada. Nenhuma policy nova, nenhuma coluna nova — `types.ts` não precisa ser regenerado.

## O que NÃO muda
Rota `/pedidos`, permKey `pedidos`, lógica dos filtros existentes, aba Rascunhos, formulário, demais itens do menu, valores de acesso já concedidos.

## Critérios de aceite
- Submenu expansível "Solicitação de Peças" com "Envios" e "Coleta Reversa".
- Cada item abre `/pedidos` já com o respectivo filtro selecionado; `/pedidos` sem parâmetro abre em "Todos".
- Botões de filtro continuam livres após a abertura.
- Nenhum papel perde acesso à tela.

## Validação
Build OK em `/tmp/observability/build-errors.log`; conferência no preview navegando pelos dois itens do submenu e verificando o filtro ativo; `read_query` confirmando as novas linhas de permissão por role.
