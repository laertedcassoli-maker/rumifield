import { Home, MapPin, ShoppingCart, Users, Settings, LogOut, Beaker, Truck, ChevronDown, ClipboardCheck, TrendingDown, Play, Building2, History, Package, FlaskConical, Shield, Wrench, ListChecks, Box, FileText } from 'lucide-react';
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
    { title: 'Visitas', icon: MapPin, url: '/visitas', permKey: 'visitas' },
    { title: 'Solicitação Peças', icon: ShoppingCart, url: '/pedidos', permKey: 'pedidos' },
  ].filter(item => canAccess(item.permKey));

  // Estoque submenu
  const estoqueItems = [
    { title: 'Aferição', icon: ClipboardCheck, url: '/estoque', permKey: 'estoque_afericao' },
    { title: 'Consumo', icon: TrendingDown, url: '/estoque/consumo', permKey: 'estoque_consumo' },
    { title: 'Previsão Envios', icon: Package, url: '/estoque/previsao', permKey: 'estoque_previsao' },
    { title: 'Histórico', icon: History, url: '/estoque/historico', permKey: 'estoque_historico' },
  ].filter(item => canAccess(item.permKey));

  const showEstoqueMenu = canAccess('estoque') && estoqueItems.length > 0;
  const isEstoqueActive = location.pathname === '/estoque' || location.pathname.startsWith('/estoque/');

  // Oficina submenu items
  const oficinaItems = [
    { title: 'Ordens de Serviço', icon: FileText, url: '/oficina/os', permKey: 'oficina_os' },
    { title: 'Atividades', icon: ListChecks, url: '/oficina/atividades', permKey: 'oficina_atividades' },
    { title: 'Cadastro Ativos', icon: Box, url: '/oficina/itens', permKey: 'oficina_itens' },
  ].filter(item => canAccess(item.permKey));

  const showOficinaMenu = canAccess('oficina') && oficinaItems.length > 0;
  const isOficinaActive = location.pathname.startsWith('/oficina');

  // Admin menu items
  const adminMenuItems = [
    { title: 'Clientes', icon: Building2, url: '/admin/clientes', permKey: 'admin_clientes' },
    { title: 'Usuários', icon: Users, url: '/admin/usuarios', permKey: 'admin_usuarios' },
    { title: 'Envios', icon: Truck, url: '/admin/envios', permKey: 'admin_envios' },
    { title: 'Cadastros', icon: Settings, url: '/admin/config', permKey: 'admin_cadastros' },
    { title: 'Permissões', icon: Shield, url: '/admin/permissoes', permKey: 'admin_permissoes' },
    { title: 'Teste Transcrição', icon: FlaskConical, url: '/teste', permKey: 'admin_cadastros' },
  ].filter(item => canAccess(item.permKey));

  const showAdminMenu = adminMenuItems.length > 0;

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
