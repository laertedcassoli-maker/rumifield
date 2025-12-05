import { Home, MapPin, Package, ShoppingCart, Users, Settings, LogOut, Beaker, Truck, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link, useLocation } from 'react-router-dom';

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();

  const { data: produtos } = useQuery({
    queryKey: ['produtos-sidebar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_quimicos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const mainMenuItems = [
    { title: 'Início', icon: Home, url: '/' },
    { title: 'Visitas', icon: MapPin, url: '/visitas' },
    { title: 'Pedidos', icon: ShoppingCart, url: '/pedidos' },
  ];

  const isEstoqueActive = location.pathname === '/estoque' || location.pathname.startsWith('/estoque/');

  const adminMenuItems = [
    { title: 'Clientes', icon: Package, url: '/admin/clientes' },
    { title: 'Usuários', icon: Users, url: '/admin/usuarios' },
    { title: 'Envios', icon: Truck, url: '/admin/envios' },
    { title: 'Configurações', icon: Settings, url: '/admin/config' },
  ];

  const showAdminMenu = role === 'admin' || role === 'gestor';

  // Filter admin menu items - Envios only for admin
  const filteredAdminItems = adminMenuItems.filter((item) => {
    if (item.url === '/admin/envios') return role === 'admin';
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">AgriField</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Campo</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Estoque com submenu */}
              <Collapsible defaultOpen={isEstoqueActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isEstoqueActive}>
                      <Beaker className="h-4 w-4" />
                      <span>Estoque</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname === '/estoque'}>
                          <Link to="/estoque">
                            <span>Visão Geral</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {produtos?.map((produto) => (
                        <SidebarMenuSubItem key={produto.id}>
                          <SidebarMenuSubButton 
                            asChild 
                            isActive={location.pathname === `/estoque/produto/${produto.id}`}
                          >
                            <Link to={`/estoque/produto/${produto.id}`}>
                              <span>{produto.nome}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <Link to={item.url}>
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

      <SidebarFooter className="border-t border-sidebar-border p-4">
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
          <button
            onClick={signOut}
            className="p-2 rounded-md hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
