import { Home, MapPin, ShoppingCart, Users, Settings, LogOut, Beaker, Truck, ChevronDown, ClipboardCheck, TrendingDown, Play, Building2, History, Package, FlaskConical, Shield, Wrench, ListChecks, Box, FileText, Calendar, Route, CalendarDays, ClipboardList, AlertTriangle, Navigation, BookOpen, Bot, Contact } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link, useLocation } from 'react-router-dom';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { useSidebar } from '@/components/ui/sidebar';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  coordenador_rplus: 'Coordenador R+',
  consultor_rplus: 'Consultor R+',
  coordenador_servicos: 'Coord. Serviços',
  tecnico_campo: 'Técnico Campo',
  tecnico_oficina: 'Técnico Oficina',
};

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { canAccess, canAccessAny, isLoading } = useMenuPermissions();

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Main menu items with permission keys
  const mainMenuItems = [
    { title: 'Início', icon: Home, url: '/', permKey: 'inicio' },
    { title: 'Minhas Rotas', icon: Navigation, url: '/preventivas/minhas-rotas', permKey: 'minhas_rotas' },
    { title: 'Chamados', icon: AlertTriangle, url: '/chamados', permKey: 'chamados' },
    { title: 'Clientes', icon: Contact, url: '/clientes', permKey: 'crm_clientes' },
    { title: 'Solicitação Peças', icon: ShoppingCart, url: '/pedidos', permKey: 'pedidos' },
  ].filter(item => canAccess(item.permKey));

  // Preventivas submenu - items vary by role
  const isTecnicoCampo = role === 'tecnico_campo';
  const isAdminOrCoordServicos = role === 'admin' || role === 'coordenador_servicos';
  
  // Preventivas submenu - "Minhas Rotas" moved to main menu, only show management items here
  const preventivasItems = isAdminOrCoordServicos
    ? [
        { title: 'Clientes Preventiva', icon: Building2, url: '/preventivas', permKey: 'preventivas' },
        { title: 'Rotas', icon: Route, url: '/preventivas/rotas', permKey: 'preventivas' },
        { title: 'Calendário Anual', icon: CalendarDays, url: '/preventivas/calendario', permKey: 'preventivas' },
      ]
    : [
        { title: 'Clientes Preventiva', icon: Building2, url: '/preventivas', permKey: 'preventivas' },
        { title: 'Rotas', icon: Route, url: '/preventivas/rotas', permKey: 'preventivas' },
        { title: 'Calendário Anual', icon: CalendarDays, url: '/preventivas/calendario', permKey: 'preventivas' },
      ];

  const filteredPreventivasItems = preventivasItems.filter(item => canAccess(item.permKey));

  // For tecnico_campo, hide the Preventivas submenu entirely (they use "Minhas Rotas" in main menu)
  const showPreventivasMenu = canAccess('preventivas') && filteredPreventivasItems.length > 0 && !isTecnicoCampo;
  const isPreventivasActive = location.pathname === '/preventivas' || (location.pathname.startsWith('/preventivas/') && !location.pathname.startsWith('/preventivas/minhas-rotas') && !location.pathname.startsWith('/preventivas/execucao'));

  // Estoque submenu
  const estoqueItems = [
    { title: 'Aferição', icon: ClipboardCheck, url: '/estoque', permKey: 'estoque_afericao' },
    { title: 'Consumo', icon: TrendingDown, url: '/estoque/consumo', permKey: 'estoque_consumo' },
    { title: 'Previsão Envios', icon: Package, url: '/estoque/previsao', permKey: 'estoque_previsao' },
    { title: 'Histórico', icon: History, url: '/estoque/historico', permKey: 'estoque_historico' },
  ].filter(item => canAccess(item.permKey));

  const showEstoqueMenu = canAccess('estoque') && estoqueItems.length > 0;
  const isEstoqueActive = location.pathname === '/estoque' || location.pathname.startsWith('/estoque/');

  // Oficina submenu items (operational - OS and Assets)
  const oficinaItems = [
    { title: 'Ordens de Serviço', icon: FileText, url: '/oficina/os', permKey: 'oficina_os' },
    { title: 'Cadastro Ativos', icon: Box, url: '/oficina/itens', permKey: 'oficina_itens' },
    { title: 'Garantias Motor', icon: Shield, url: '/oficina/garantias', permKey: 'oficina_garantias' },
  ].filter(item => canAccess(item.permKey));

  const showOficinaMenu = canAccess('oficina') && oficinaItems.length > 0;
  const isOficinaActive = location.pathname.startsWith('/oficina') && !location.pathname.includes('/atividades');

  // Admin Oficina submenu (configuration items)
  const adminOficinaItems = [
    { title: 'Atividades', icon: ListChecks, url: '/oficina/atividades', permKey: 'oficina_atividades' },
  ].filter(item => canAccess(item.permKey));

  const showAdminOficinaMenu = adminOficinaItems.length > 0;
  const isAdminOficinaActive = location.pathname === '/oficina/atividades';

  // Admin Manutenção submenu (preventive maintenance configuration)
  const adminManutencaoItems = [
    { title: 'Templates Checklist', icon: ClipboardList, url: '/preventivas/checklists', permKey: 'admin_cadastros' },
  ].filter(item => canAccess(item.permKey));

  const showAdminManutencaoMenu = adminManutencaoItems.length > 0;
  const isAdminManutencaoActive = location.pathname.startsWith('/preventivas/checklists');

  // Admin menu items
  const adminMenuItems = [
    { title: 'Clientes', icon: Building2, url: '/admin/clientes', permKey: 'admin_clientes' },
    { title: 'Usuários', icon: Users, url: '/admin/usuarios', permKey: 'admin_usuarios' },
    { title: 'Envios', icon: Truck, url: '/admin/envios', permKey: 'admin_envios' },
    { title: 'Cadastros', icon: Settings, url: '/admin/config', permKey: 'admin_cadastros' },
    { title: 'Permissões', icon: Shield, url: '/admin/permissoes', permKey: 'admin_permissoes' },
    { title: 'Documentação', icon: BookOpen, url: '/docs', permKey: 'admin_permissoes' },
    { title: 'API Docs (IA)', icon: Bot, url: '/docs/api-docs-ai-layer', permKey: 'admin_permissoes' },
    { title: 'Teste Transcrição', icon: FlaskConical, url: '/teste', permKey: 'admin_cadastros' },
  ].filter(item => canAccess(item.permKey));

  const showAdminMenu = adminMenuItems.length > 0 || showAdminOficinaMenu || showAdminManutencaoMenu;

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
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

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

              {/* Preventivas com submenu */}
              {showPreventivasMenu && (
                <Collapsible defaultOpen={isPreventivasActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isPreventivasActive}>
                        <Calendar className="h-4 w-4" />
                        <span>Preventivas</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {filteredPreventivasItems.map(item => (
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

              {/* Oficina com submenu */}
              {showOficinaMenu && (
                <Collapsible defaultOpen={isOficinaActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isOficinaActive}>
                        <Wrench className="h-4 w-4" />
                        <span>Oficina</span>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <Link to={item.url} onClick={handleMenuClick}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Manutenção submenu dentro de Administração */}
                {showAdminManutencaoMenu && (
                  <Collapsible defaultOpen={isAdminManutencaoActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isAdminManutencaoActive}>
                          <Calendar className="h-4 w-4" />
                          <span>Manutenção</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminManutencaoItems.map(item => (
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

                {/* Oficina submenu dentro de Administração */}
                {showAdminOficinaMenu && (
                  <Collapsible defaultOpen={isAdminOficinaActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isAdminOficinaActive}>
                          <Wrench className="h-4 w-4" />
                          <span>Oficina</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminOficinaItems.map(item => (
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
