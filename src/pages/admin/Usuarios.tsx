import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  tecnico: 'Técnico',
};

const roleColors: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  gestor: 'bg-warning/10 text-warning border-warning/20',
  tecnico: 'bg-primary/10 text-primary border-primary/20',
};

export default function AdminUsuarios() {
  const { role: currentUserRole, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as 'admin' | 'gestor' | 'tecnico' })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
      toast({ title: 'Permissão atualizada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    if (userId === currentUser?.id) {
      toast({ variant: 'destructive', title: 'Você não pode alterar sua própria permissão' });
      return;
    }
    updateRole.mutate({ userId, newRole });
  };

  const isAdmin = currentUserRole === 'admin';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Gerencie os usuários e suas permissões</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : usuarios?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum usuário cadastrado</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {usuarios?.map((usuario: any) => {
            const userRole = usuario.user_roles?.[0]?.role || 'tecnico';
            const isCurrentUser = usuario.id === currentUser?.id;

            return (
              <Card key={usuario.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {usuario.nome?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{usuario.nome}</p>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">Você</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{usuario.email}</p>
                  </div>
                  {isAdmin && !isCurrentUser ? (
                    <Select
                      value={userRole}
                      onValueChange={(value) => handleRoleChange(usuario.id, value)}
                      disabled={updateRole.isPending}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={roleColors[userRole]}>
                      <Shield className="mr-1 h-3 w-3" />
                      {roleLabels[userRole]}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
