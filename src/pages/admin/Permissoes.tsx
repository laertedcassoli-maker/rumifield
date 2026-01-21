import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Loader2, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

const menuGroupLabels: Record<string, string> = {
  principal: 'Menu Principal',
  estoque: 'Estoque Químicos',
  admin: 'Administração',
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
    return rolePerms.reduce((acc, perm) => {
      if (!acc[perm.menu_group]) acc[perm.menu_group] = [];
      acc[perm.menu_group].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissionsByRole, selectedRole]);

  const handleToggle = (permission: Permission) => {
    if (selectedRole === 'admin' && currentUserRole !== 'admin') {
      toast({ variant: 'destructive', title: 'Apenas admins podem alterar permissões de admin' });
      return;
    }
    updatePermission.mutate({ id: permission.id, can_access: !permission.can_access });
  };

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
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className={roleColors[role]}>
                  <Shield className="mr-1 h-3 w-3" />
                  {roleLabels[role]}
                </Badge>
              </div>

              {Object.entries(groupedPermissions).map(([group, perms]) => (
                <Card key={group}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Menu className="h-4 w-4" />
                      {menuGroupLabels[group] || group}
                    </CardTitle>
                  </CardHeader>
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
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
