import { Fragment } from 'react';
import { Home, MapPin, ShoppingCart, Users, Settings, LogOut, Beaker, Truck, RefreshCcw, ChevronDown, ClipboardCheck, TrendingDown, Play, Building2, History, Package, FlaskConical, Shield, Wrench, ListChecks, ListTodo, Box, FileText, Calendar, Route, CalendarDays, ClipboardList, AlertTriangle, Navigation, BookOpen, Bot, Contact, Briefcase, BarChart3, BarChart2, Eye, Brain, Sheet, HardHat, Construction } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link, useLocation } from 'react-router-dom';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { usePendenciasCount } from '@/hooks/usePendenciasCount';
import { useMinhasPendenciasCount } from '@/hooks/useMinhasPendencias';

import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  coordenador_rplus: 'Coordenador R+',
  consultor_rplus: 'Consultor R+',
  coordenador_servicos: 'Coord. Serviços',
  coordenador_logistica: 'Coord. Logística',
  tecnico_campo: 'Técnico Campo',
  tecnico_oficina: 'Técnico Oficina',
  financeiro: 'Financeiro',
};

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { canAccess, isLoading } = useMenuPermissions();
  const pendenciasCount = usePendenciasCount();
  const minhasPendenciasCount = useMinhasPendenciasCount();


  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Main menu items with permission keys
  const mainMenuItems = [
    { title: 'Início', icon: Home, url: '/', permKey: 'inicio' },
    { title: 'Agenda de Operações', icon: CalendarDays, url: '/agenda-operacoes', permKey: 'agenda_operacoes' },
    { title: 'Minhas Pendências', icon: ListTodo, url: '/minhas-pendencias', permKey: 'minhas_pendencias' },
    { title: 'Minhas Rotas', icon: Navigation, url: '/preventivas/minhas-rotas', permKey: 'minhas_rotas' },
  ].filter(item => canAccess(item.permKey));


  // Novas Instalações submenu (single permKey 'instalacoes' gates the whole group)
  const instalacoesItems = [
    { title: 'Pré Instalação', icon: ListChecks, url: '/instalacoes?etapa=pre_instalacao' },
    { title: 'Instalação', icon: HardHat, url: '/instalacoes?etapa=instalacao' },
  ];

  const isInstalacoesActive = location.pathname === '/instalacoes';
  const showInstalacoesMenu = canAccess('instalacoes');

  // Solicitação de Peças submenu
  const pedidosItems = [
    { title: 'Envios', icon: Truck, url: '/pedidos?tipo=envio', permKey: 'pedidos_envios' },
    { title: 'Coleta Reversa', icon: RefreshCcw, url: '/pedidos?tipo=coleta_reversa', permKey: 'pedidos_coleta_reversa' },
  ].filter(item => canAccess(item.permKey));

  const showPedidosMenu = canAccess('pedidos') && pedidosItems.length > 0;
  const isPedidosActive = location.pathname === '/pedidos';

  // CRM submenu - Inteligência remains in Administração
  const crmItems = [
    { title: 'Dashboard CRM', icon: BarChart3, url: '/crm/dashboard', permKey: 'crm_clientes' },
    { title: 'CRM Carteira', icon: Briefcase, url: '/crm/carteira', permKey: 'crm_clientes' },
    { title: 'Visitas CRM', icon: Eye, url: '/crm/visitas', permKey: 'crm_clientes' },
    { title: 'Pipeline', icon: BarChart3, url: '/crm/pipeline', permKey: 'crm_clientes' },
    { title: 'Tarefas CRM', icon: ListChecks, url: '/crm/acoes', permKey: 'crm_clientes' },
  ].filter(item => canAccess(item.permKey));

  const crmRoutes = ['/crm/dashboard', '/crm/carteira', '/crm/visitas', '/crm/pipeline', '/crm/acoes'];
  const isCrmActive = crmRoutes.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
  const showCrmMenu = canAccess('crm') && crmItems.length > 0;

  // Preventivas submenu - items vary by role
  const isTecnicoCampo = role === 'tecnico_campo';
  const isAdminOrCoordServicos = role === 'admin' || role === 'coordenador_servicos';
  
  // Preventivas submenu - "Minhas Rotas" moved to main menu, only show management items here
  const preventivasItems = [
    { title: 'Clientes Preventiva', icon: Building2, url: '/preventivas', permKey: 'preventivas' },
    { title: 'Rotas', icon: Route, url: '/preventivas/rotas', permKey: 'preventivas' },
    { title: 'Calendário Anual', icon: CalendarDays, url: '/preventivas/calendario', permKey: 'preventivas' },
  ];

  const filteredPreventivasItems = preventivasItems.filter(item => canAccess(item.permKey));

  // For tecnico_campo, hide the Preventivas submenu entirely (they use "Minhas Rotas" in main menu)
  const showPreventivasMenu = canAccess('preventivas') && filteredPreventivasItems.length > 0 && !isTecnicoCampo;
  const isPreventivasActive = location.pathname === '/preventivas' || (location.pathname.startsWith('/preventivas/') && !location.pathname.startsWith('/preventivas/minhas-rotas') && !location.pathname.startsWith('/preventivas/execucao'));

  // Instalações Existentes submenu
  const installationItems = [
    { title: 'Chamados', icon: AlertTriangle, url: '/chamados', permKey: 'chamados' },
    { title: 'Visita Técnica', icon: Contact, url: '/visita-tecnica', permKey: 'visita_tecnica' },
    { title: 'Clientes', icon: Building2, url: '/crm/carteira', permKey: 'instalacoes_clientes' },
  ].filter(item => canAccess(item.permKey));

  const isClienteRouteActive = location.pathname === '/crm/carteira' || (
    location.pathname.startsWith('/crm/') &&
    !crmRoutes.some(path => location.pathname === path || location.pathname.startsWith(path + '/')) &&
    location.pathname !== '/crm/inteligencia'
  );
  const isInstallationsActive = isPreventivasActive || location.pathname.startsWith('/chamados') || isClienteRouteActive || location.pathname.startsWith('/visita-tecnica');
  const showInstallationsMenu = canAccess('instalacoes_existentes') && (showPreventivasMenu || installationItems.length > 0);

  // Estoque submenu
  const estoqueItems = [
    { title: 'Aferição', icon: ClipboardCheck, url: '/estoque', permKey: 'estoque_afericao' },
    { title: 'Consumo', icon: TrendingDown, url: '/estoque/consumo', permKey: 'estoque_consumo' },
    { title: 'Previsão Envios', icon: Package, url: '/estoque/previsao', permKey: 'estoque_previsao' },
    { title: 'Histórico', icon: History, url: '/estoque/historico', permKey: 'estoque_historico' },
  ].filter(item => canAccess(item.permKey));

  const showEstoqueMenu = canAccess('estoque') && estoqueItems.length > 0;
  const isEstoqueActive = location.pathname === '/estoque' || location.pathname.startsWith('/estoque/');

  // Centro de Serviços submenu items (technical keys and routes remain oficina_*)
  const oficinaItems = [
    { title: 'Ordens de Serviço', icon: FileText, url: '/oficina/os', permKey: 'oficina_os' },
    { title: 'Cadastro Ativos', icon: Box, url: '/oficina/itens', permKey: 'oficina_itens' },
    { title: 'Garantias Motor', icon: Shield, url: '/oficina/garantias', permKey: 'oficina_garantias' },

  ].filter(item => canAccess(item.permKey));

  const showOficinaMenu = canAccess('oficina') && oficinaItems.length > 0;
  const isOficinaActive = location.pathname.startsWith('/oficina') && !location.pathname.includes('/atividades');

  // Admin top-level items (flat)
  const adminTopItems = [
    { title: 'Dashboards', icon: BarChart2, url: '/admin/dashboards', permKey: 'oficina_gestao_os' },
    { title: 'Clientes', icon: Building2, url: '/admin/clientes', permKey: 'admin_clientes' },
    { title: 'Envios Químicos', icon: Truck, url: '/admin/envios', permKey: 'admin_envios' },
    { title: 'Inteligência', icon: Brain, url: '/crm/inteligencia', permKey: 'crm_inteligencia' },
    { title: 'Analytics', icon: BarChart2, url: '/admin/analytics', permKey: 'admin_analytics' },

  ].filter(item => canAccess(item.permKey));

  // Admin > Usuários submenu (Usuários + Permissões)
  const adminUsuariosItems = [
    { title: 'Usuários', icon: Users, url: '/admin/usuarios', permKey: 'admin_usuarios' },
    { title: 'Permissões', icon: Shield, url: '/admin/permissoes', permKey: 'admin_permissoes' },
  ].filter(item => canAccess(item.permKey));

  const isAdminUsuariosActive = location.pathname.startsWith('/admin/usuarios') || location.pathname.startsWith('/admin/permissoes');
  const showUsuariosMenu = (canAccess('admin_usuarios') || canAccess('admin_permissoes')) && adminUsuariosItems.length > 0;

  // Admin > Cadastros submenu
  const adminCadastrosItems = [
    { title: 'Produtos Químicos', icon: FlaskConical, url: '/admin/config?tab=quimicos', permKey: 'admin_cadastros' },
    { title: 'Catálogo de Peças', icon: Box, url: '/admin/config?tab=pecas', permKey: 'admin_cadastros' },
    { title: 'Config. CRM', icon: Briefcase, url: '/admin/crm', permKey: 'admin_cadastros' },
    { title: 'Tags', icon: AlertTriangle, url: '/admin/ticket-tags', permKey: 'admin_cadastros' },
    { title: 'Templates Checklist', icon: ClipboardList, url: '/preventivas/checklists', permKey: 'admin_cadastros' },
    { title: 'Atividades Centro de Serviços', icon: ListChecks, url: '/oficina/atividades', permKey: 'oficina_atividades' },
    { title: 'Google Sheets', icon: Sheet, url: '/admin/config/google-sheets', permKey: 'admin_cadastros' },
  ].filter(item => canAccess(item.permKey));

  const isAdminCadastrosActive = ['/admin/config', '/admin/crm', '/admin/ticket-tags', '/preventivas/checklists', '/oficina/atividades', '/admin/config/google-sheets'].some(
    p => location.pathname === p || location.pathname.startsWith(p + '/')
  ) || location.search.includes('tab=quimicos') || location.search.includes('tab=pecas');

  // Admin > Configurações submenu
  const adminConfigItems = [
    { title: 'Geral', icon: Settings, url: '/admin/config?tab=config', permKey: 'admin_cadastros' },
    { title: 'Integrações', icon: Truck, url: '/admin/config?tab=integracoes', permKey: 'admin_cadastros' },
  ].filter(item => canAccess(item.permKey));

  const isAdminConfigActive = location.search.includes('tab=config') || location.search.includes('tab=integracoes');

  // Admin > Documentação submenu
  const adminDocsItems = [
    { title: 'Documentos', icon: BookOpen, url: '/docs', permKey: 'admin_permissoes' },
    { title: 'API Docs (IA)', icon: Bot, url: '/docs/api-docs-ai-layer', permKey: 'admin_permissoes' },
    { title: 'Teste Transcrição', icon: FlaskConical, url: '/teste', permKey: 'admin_cadastros' },
  ].filter(item => canAccess(item.permKey));

  const isAdminDocsActive = location.pathname.startsWith('/docs') || location.pathname === '/teste';

  const showAdminMenu = adminTopItems.length > 0 || adminCadastrosItems.length > 0 || adminConfigItems.length > 0 || adminDocsItems.length > 0;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/" onClick={handleMenuClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Play className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">RumiField</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Campo</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isLoading ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="space-y-2 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
        <>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url} onClick={handleMenuClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.permKey === 'minhas_pendencias' && minhasPendenciasCount > 0 && (
                        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                          {minhasPendenciasCount}
                        </Badge>
                      )}
                    </Link>

                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Novas Instalações com submenu */}
              {showInstalacoesMenu && (
                <Collapsible defaultOpen={isInstalacoesActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isInstalacoesActive}>
                        <Construction className="h-4 w-4" />
                        <span>Novas Instalações</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {instalacoesItems.map(item => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname + location.search === item.url}>
                              <Link to={item.url} onClick={handleMenuClick}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Instalações Existentes com submenu */}
              {showInstallationsMenu && (
                <Collapsible defaultOpen={isInstallationsActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isInstallationsActive}>
                        <MapPin className="h-4 w-4" />
                        <span>Instalações Existentes</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {showPreventivasMenu && (
                          <SidebarMenuSubItem>
                            <Collapsible defaultOpen={isPreventivasActive} className="group/preventivas">
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isPreventivasActive}>
                                  <Calendar className="h-4 w-4" />
                                  <span>Preventivas</span>
                                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/preventivas:rotate-180" />
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-3 mr-0">
                                  {filteredPreventivasItems.map(item => (
                                    <SidebarMenuSubItem key={item.title}>
                                      <SidebarMenuSubButton asChild size="sm" isActive={location.pathname === item.url || location.pathname.startsWith(item.url + '/')}>
                                        <Link to={item.url} onClick={handleMenuClick}>
                                          <item.icon className="h-4 w-4" />
                                          <span>{item.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </Collapsible>
                          </SidebarMenuSubItem>
                        )}
                        {installationItems.map(item => {
                          const isClientesItem = item.title === 'Clientes';
                          const isItemActive = isClientesItem
                            ? isClienteRouteActive
                            : location.pathname === item.url || location.pathname.startsWith(item.url + '/');

                          return (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild isActive={isItemActive}>
                                <Link to={item.url} onClick={handleMenuClick}>
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}


              {/* Solicitação de Peças com submenu */}
              {showPedidosMenu && (
                <Collapsible defaultOpen={isPedidosActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isPedidosActive}>
                        <ShoppingCart className="h-4 w-4" />
                        <span>Solicitação de Peças</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {pedidosItems.map(item => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname + location.search === item.url}>
                              <Link to={item.url} onClick={handleMenuClick}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                                {item.permKey === 'pedidos_coleta_reversa' && pendenciasCount > 0 && (
                                  <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                                    {pendenciasCount}
                                  </Badge>
                                )}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Centro de Serviços com submenu */}
              {showOficinaMenu && (
                <Collapsible defaultOpen={isOficinaActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isOficinaActive}>
                        <Wrench className="h-4 w-4" />
                        <span>Centro de Serviços</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {oficinaItems.map(item => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname === item.url}>
                              <Link to={item.url} onClick={handleMenuClick}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* CRM com submenu */}
              {showCrmMenu && (
                <Collapsible defaultOpen={isCrmActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isCrmActive}>
                        <Briefcase className="h-4 w-4" />
                        <span>CRM</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {crmItems.map(item => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname === item.url || location.pathname.startsWith(item.url + '/')}>
                              <Link to={item.url} onClick={handleMenuClick}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}


              {/* Estoque com submenu */}
              {showEstoqueMenu && (
                <Collapsible defaultOpen={isEstoqueActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isEstoqueActive}>
                        <Beaker className="h-4 w-4" />
                        <span>Estoque Químicos</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {estoqueItems.map(item => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname === item.url}>
                              <Link to={item.url} onClick={handleMenuClick}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminTopItems.map(item => (
                  <Fragment key={item.title}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                        <Link to={item.url} onClick={handleMenuClick}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Usuários submenu (após Clientes, onde ficava o item solto) */}
                    {item.title === 'Clientes' && showUsuariosMenu && (
                      <Collapsible defaultOpen={isAdminUsuariosActive} className="group/collapsible">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton isActive={isAdminUsuariosActive}>
                              <Users className="h-4 w-4" />
                              <span>Usuários</span>
                              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {adminUsuariosItems.map(sub => (
                                <SidebarMenuSubItem key={sub.title}>
                                  <SidebarMenuSubButton asChild isActive={location.pathname === sub.url}>
                                    <Link to={sub.url} onClick={handleMenuClick}>
                                      <sub.icon className="h-4 w-4" />
                                      <span>{sub.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )}
                  </Fragment>
                ))}

                {/* Cadastros submenu */}
                {adminCadastrosItems.length > 0 && (
                  <Collapsible defaultOpen={isAdminCadastrosActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isAdminCadastrosActive}>
                          <ClipboardList className="h-4 w-4" />
                          <span>Cadastros</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminCadastrosItems.map(item => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild isActive={location.pathname + location.search === item.url || location.pathname === item.url}>
                                <Link to={item.url} onClick={handleMenuClick}>
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )}

                {/* Configurações submenu */}
                {adminConfigItems.length > 0 && (
                  <Collapsible defaultOpen={isAdminConfigActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isAdminConfigActive}>
                          <Settings className="h-4 w-4" />
                          <span>Configurações</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminConfigItems.map(item => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild isActive={location.pathname + location.search === item.url}>
                                <Link to={item.url} onClick={handleMenuClick}>
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )}

                {/* Documentação submenu */}
                {adminDocsItems.length > 0 && (
                  <Collapsible defaultOpen={isAdminDocsActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isAdminDocsActive}>
                          <BookOpen className="h-4 w-4" />
                          <span>Documentação</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminDocsItems.map(item => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild isActive={location.pathname === item.url || location.pathname.startsWith(item.url + '/')}>
                                <Link to={item.url} onClick={handleMenuClick}>
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        <div className="flex items-center justify-center">
          <OfflineIndicator />
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
              {profile?.nome?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.nome || 'Usuário'}
            </p>
            <p className="text-xs text-sidebar-foreground/60">{roleLabels[role || ''] || role}</p>
          </div>
          <button onClick={signOut} className="p-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
