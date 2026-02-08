import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Loader2, ChevronDown, Home, Beaker, Wrench, Settings, AlertTriangle, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  coordenador_rplus: 'Coordenador R+',
  consultor_rplus: 'Consultor R+',
  coordenador_servicos: 'Coordenador de Serviços',
  tecnico_campo: 'Técnico de Campo',
  tecnico_oficina: 'Técnico de Oficina',
};

const roleColors: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  coordenador_rplus: 'bg-warning/10 text-warning border-warning/20',
  coordenador_servicos: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  consultor_rplus: 'bg-primary/10 text-primary border-primary/20',
  tecnico_campo: 'bg-green-500/10 text-green-600 border-green-500/20',
  tecnico_oficina: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const menuGroupConfig: Record<string, { label: string; icon: typeof Home; order: number }> = {
  principal: { label: 'Menu Principal', icon: Home, order: 1 },
  estoque: { label: 'Estoque Químicos', icon: Beaker, order: 2 },
  oficina: { label: 'Oficina', icon: Wrench, order: 3 },
  chamados: { label: 'Chamados Técnicos', icon: AlertTriangle, order: 4 },
  admin: { label: 'Administração', icon: Settings, order: 5 },
};

const roles = [
  'admin',
  'coordenador_rplus',
  'consultor_rplus',
  'coordenador_servicos',
  'tecnico_campo',
  'tecnico_oficina',
] as const;

interface Permission {
  id: string;
  role: string;
  menu_key: string;
  menu_label: string;
  menu_group: string;
  can_access: boolean;
}

export default function AdminPermissoes() {
  const { role: currentUserRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['role-menu-permissions'],
    queryFn: async () => {
      // @ts-ignore - Table not yet in types
      const { data, error } = await supabase
        .from('role_menu_permissions')
        .select('*')
        .order('menu_group')
        .order('menu_key');
      if (error) throw error;
      return data as Permission[];
    },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ id, can_access }: { id: string; can_access: boolean }) => {
      // @ts-ignore - Table not yet in types
      const { error } = await supabase
        .from('role_menu_permissions')
        .update({ can_access })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-menu-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-menu-permissions'] });
      toast({ title: 'Permissão atualizada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });

  const permissionsByRole = useMemo(() => {
    if (!permissions) return {};
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.role]) acc[perm.role] = [];
      acc[perm.role].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  const groupedPermissions = useMemo(() => {
    const rolePerms = permissionsByRole[selectedRole] || [];
    const grouped = rolePerms.reduce((acc, perm) => {
      if (!acc[perm.menu_group]) acc[perm.menu_group] = [];
      acc[perm.menu_group].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);

    // Sort groups by configured order
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
      const orderA = menuGroupConfig[a]?.order ?? 99;
      const orderB = menuGroupConfig[b]?.order ?? 99;
      return orderA - orderB;
    });

    return sortedEntries;
  }, [permissionsByRole, selectedRole]);

  const handleToggle = (permission: Permission) => {
    if (selectedRole === 'admin' && currentUserRole !== 'admin') {
      toast({ variant: 'destructive', title: 'Apenas admins podem alterar permissões de admin' });
      return;
    }
    updatePermission.mutate({ id: permission.id, can_access: !permission.can_access });
  };

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const isGroupOpen = (group: string) => {
    return openGroups[group] ?? true; // default open
  };

  const toggleAllGroups = (open: boolean) => {
    const newState: Record<string, boolean> = {};
    groupedPermissions.forEach(([group]) => {
      newState[group] = open;
    });
    setOpenGroups(newState);
  };

  const enabledCount = useMemo(() => {
    const rolePerms = permissionsByRole[selectedRole] || [];
    return rolePerms.filter(p => p.can_access).length;
  }, [permissionsByRole, selectedRole]);

  const totalCount = useMemo(() => {
    return (permissionsByRole[selectedRole] || []).length;
  }, [permissionsByRole, selectedRole]);

  const isAdmin = currentUserRole === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Shield className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Acesso Restrito</h3>
        <p className="text-muted-foreground">Apenas administradores podem gerenciar permissões</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Permissões de Menu</h1>
        <p className="text-muted-foreground">Controle quais menus cada perfil pode acessar</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={selectedRole} onValueChange={setSelectedRole}>
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
            {roles.map((role) => (
              <TabsTrigger
                key={role}
                value={role}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {roleLabels[role]}
              </TabsTrigger>
            ))}
          </TabsList>

          {roles.map((role) => (
            <TabsContent key={role} value={role} className="mt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={roleColors[role]}>
                    <Shield className="mr-1 h-3 w-3" />
                    {roleLabels[role]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {enabledCount}/{totalCount} menus ativos
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAllGroups(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Expandir todos
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={() => toggleAllGroups(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Recolher todos
                  </button>
                </div>
              </div>

              {groupedPermissions.map(([group, perms]) => {
                const config = menuGroupConfig[group] || { label: group, icon: Settings, order: 99 };
                const GroupIcon = config.icon;
                const groupEnabledCount = perms.filter(p => p.can_access).length;

                return (
                  <Collapsible
                    key={group}
                    open={isGroupOpen(group)}
                    onOpenChange={() => toggleGroup(group)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <GroupIcon className="h-4 w-4" />
                            {config.label}
                            <Badge variant="secondary" className="ml-auto text-xs font-normal">
                              {groupEnabledCount}/{perms.length}
                            </Badge>
                            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Menu</TableHead>
                                <TableHead className="w-24 text-center">Acesso</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {perms.map((perm) => (
                                <TableRow key={perm.id}>
                                  <TableCell>{perm.menu_label}</TableCell>
                                  <TableCell className="text-center">
                                    <Switch
                                      checked={perm.can_access}
                                      onCheckedChange={() => handleToggle(perm)}
                                      disabled={updatePermission.isPending || (role === 'admin' && perm.menu_key === 'admin_permissoes')}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
