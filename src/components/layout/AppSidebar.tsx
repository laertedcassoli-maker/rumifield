import { Home, MapPin, ShoppingCart, Users, Settings, LogOut, Beaker, Truck, ChevronDown, ClipboardCheck, TrendingDown, Play, Building2, History, Package, FlaskConical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link, useLocation } from 'react-router-dom';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function AppSidebar() {
  const {
    profile,
    role,
    signOut
  } = useAuth();
  const location = useLocation();

  // Load menu visibility config
  const { data: menuConfigs } = useQuery({
    queryKey: ['menu-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['estoque_menu_enabled', 'inicio_menu_enabled']);
      if (error) throw error;
      return data;
    },
    staleTime: 5000, // Cache for 5 seconds only
    refetchOnMount: 'always',
  });

  const showEstoqueMenu = menuConfigs?.find(c => c.chave === 'estoque_menu_enabled')?.valor !== 'false';
  const showInicioMenu = menuConfigs?.find(c => c.chave === 'inicio_menu_enabled')?.valor !== 'false';
  
  const mainMenuItems = [
    ...(showInicioMenu ? [{
      title: 'Início',
      icon: Home,
      url: '/'
    }] : []),
    // { title: 'Visitas', icon: MapPin, url: '/visitas' }, // Temporariamente oculto
    {
      title: 'Solicitação Peças',
      icon: ShoppingCart,
      url: '/pedidos'
    }
  ];
  const estoqueItems = [{
    title: 'Aferição',
    icon: ClipboardCheck,
    url: '/estoque'
  }, {
    title: 'Consumo',
    icon: TrendingDown,
    url: '/estoque/consumo'
  }, {
    title: 'Previsão Envios',
    icon: Package,
    url: '/estoque/previsao'
  }, {
    title: 'Histórico',
    icon: History,
    url: '/estoque/historico'
  }];
  const isEstoqueActive = location.pathname === '/estoque' || location.pathname.startsWith('/estoque/');
  const adminMenuItems = [{
    title: 'Clientes',
    icon: Building2,
    url: '/admin/clientes'
  }, {
    title: 'Usuários',
    icon: Users,
    url: '/admin/usuarios'
  }, {
    title: 'Envios',
    icon: Truck,
    url: '/admin/envios'
  }, {
    title: 'Cadastros',
    icon: Settings,
    url: '/admin/config'
  }, {
    title: 'Teste Transcrição',
    icon: FlaskConical,
    url: '/teste'
  }];
  const showAdminMenu = role === 'admin' || role === 'gestor';

  // Filter admin menu items - Envios only for admin
  const filteredAdminItems = adminMenuItems.filter(item => {
    if (item.url === '/admin/envios') return role === 'admin';
    return true;
  });
  return <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Play className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">RumiField</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Campo</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}

              {/* Estoque com submenu - condicional */}
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
                        {estoqueItems.map(item => <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname === item.url}>
                              <Link to={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>)}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminMenu && <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdminItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
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
            <p className="text-xs text-sidebar-foreground/60 capitalize">{role}</p>
          </div>
          <button onClick={signOut} className="p-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>;
}