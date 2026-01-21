import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Loader2, Shield, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
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

type SortField = 'nome' | 'email' | 'role';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const newUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['admin', 'coordenador_rplus', 'consultor_rplus', 'coordenador_servicos', 'tecnico_campo', 'tecnico_oficina']),
});

export default function AdminUsuarios() {
  const { role: currentUserRole, user: currentUser, signUp } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    nome: '',
    email: '',
    password: '',
    role: 'consultor_rplus' as 'admin' | 'coordenador_rplus' | 'consultor_rplus' | 'coordenador_servicos' | 'tecnico_campo' | 'tecnico_oficina',
  });
  const [isCreating, setIsCreating] = useState(false);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: async () => {
      // Busca profiles e user_roles separadamente (não há FK entre elas)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('nome');
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      // Mapeia roles por user_id
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Combina profiles com seus roles
      return profiles?.map(profile => ({
        ...profile,
        user_roles: rolesMap.has(profile.id) ? [{ role: rolesMap.get(profile.id) }] : []
      })) || [];
    },
  });

  const filteredAndSortedUsuarios = useMemo(() => {
    if (!usuarios) return [];
    
    let result = usuarios.filter((usuario: any) =>
      usuario.nome?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.email?.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a: any, b: any) => {
      let aValue: string;
      let bValue: string;

      if (sortField === 'role') {
        aValue = a.user_roles?.[0]?.role || 'consultor_rplus';
        bValue = b.user_roles?.[0]?.role || 'consultor_rplus';
      } else {
        aValue = a[sortField] || '';
        bValue = b[sortField] || '';
      }

      const comparison = aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [usuarios, search, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedUsuarios.length / ITEMS_PER_PAGE);
  const paginatedUsuarios = filteredAndSortedUsuarios.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as 'admin' | 'coordenador_rplus' | 'consultor_rplus' | 'coordenador_servicos' | 'tecnico_campo' | 'tecnico_oficina' })
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = newUserSchema.safeParse(newUserForm);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: result.error.errors[0].message,
      });
      return;
    }

    setIsCreating(true);
    
    try {
      // Criar usuário via signUp
      const { error: signUpError } = await signUp(
        newUserForm.email, 
        newUserForm.password, 
        newUserForm.nome
      );
      
      if (signUpError) throw signUpError;

      // Nota: O role será atualizado manualmente após criar, pois não temos acesso ao user.id aqui
      // O usuário é criado como 'consultor_rplus' por padrão pelo trigger

      toast({ title: 'Usuário criado com sucesso!', description: newUserForm.role !== 'consultor_rplus' ? 'Atualize a permissão na lista.' : undefined });
      setOpenDialog(false);
      setNewUserForm({ nome: '', email: '', password: '', role: 'consultor_rplus' });
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast({
          variant: 'destructive',
          title: 'Email já cadastrado',
          description: 'Este email já está em uso.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao criar usuário',
          description: error.message,
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const isAdmin = currentUserRole === 'admin';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários e suas permissões</p>
        </div>
        {isAdmin && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    placeholder="Nome do usuário"
                    value={newUserForm.nome}
                    onChange={(e) => setNewUserForm({ ...newUserForm, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissão</Label>
                  <Select 
                    value={newUserForm.role} 
                    onValueChange={(v: 'admin' | 'coordenador_rplus' | 'consultor_rplus' | 'coordenador_servicos' | 'tecnico_campo' | 'tecnico_oficina') => setNewUserForm({ ...newUserForm, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="coordenador_rplus">Coordenador R+</SelectItem>
                      <SelectItem value="consultor_rplus">Consultor R+</SelectItem>
                      <SelectItem value="coordenador_servicos">Coordenador de Serviços</SelectItem>
                      <SelectItem value="tecnico_campo">Técnico de Campo</SelectItem>
                      <SelectItem value="tecnico_oficina">Técnico de Oficina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Usuário'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedUsuarios.length > 0 ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('nome')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Nome {getSortIcon('nome')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('email')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Email {getSortIcon('email')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('role')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Permissão {getSortIcon('role')}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsuarios.map((usuario: any) => {
                  const userRole = usuario.user_roles?.[0]?.role || 'consultor_rplus';
                  const isCurrentUser = usuario.id === currentUser?.id;

                  return (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {usuario.nome}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">Você</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{usuario.email}</TableCell>
                      <TableCell>
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
                              <SelectItem value="coordenador_rplus">Coordenador R+</SelectItem>
                              <SelectItem value="consultor_rplus">Consultor R+</SelectItem>
                              <SelectItem value="coordenador_servicos">Coordenador de Serviços</SelectItem>
                              <SelectItem value="tecnico_campo">Técnico de Campo</SelectItem>
                              <SelectItem value="tecnico_oficina">Técnico de Oficina</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={roleColors[userRole]}>
                            <Shield className="mr-1 h-3 w-3" />
                            {roleLabels[userRole]}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedUsuarios.length)} de {filteredAndSortedUsuarios.length} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </h3>
            <p className="text-muted-foreground">
              {search ? 'Tente outra busca' : ''}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
