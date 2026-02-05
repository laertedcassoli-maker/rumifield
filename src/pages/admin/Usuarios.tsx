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
import { Users, Loader2, Shield, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Plus, Copy, Check, Link2, Trash2 } from 'lucide-react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

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
  role: z.enum(['admin', 'coordenador_rplus', 'consultor_rplus', 'coordenador_servicos', 'tecnico_campo', 'tecnico_oficina']),
  cidade_base: z.string().optional(),
});

type AppRole = 'admin' | 'coordenador_rplus' | 'consultor_rplus' | 'coordenador_servicos' | 'tecnico_campo' | 'tecnico_oficina';

export default function AdminUsuarios() {
  const { role: currentUserRole, user: currentUser } = useAuth();
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
    role: 'consultor_rplus' as AppRole,
    cidade_base: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [editingCidadeBase, setEditingCidadeBase] = useState<{ userId: string; value: string } | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('nome');
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      return profiles?.map(profile => ({
        ...profile,
        user_roles: rolesMap.has(profile.id) ? [{ role: rolesMap.get(profile.id) }] : []
      })) || [];
    },
  });

  const { data: pendingInvites } = useQuery({
    queryKey: ['pending-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .is('used_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
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
        .update({ role: newRole as AppRole })
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

  const updateCidadeBase = useMutation({
    mutationFn: async ({ userId, cidadeBase }: { userId: string; cidadeBase: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ cidade_base: cidadeBase || null })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
      toast({ title: 'Cidade base atualizada!' });
      setEditingCidadeBase(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('user_invites')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      toast({ title: 'Convite excluído!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    if (userId === currentUser?.id) {
      toast({ variant: 'destructive', title: 'Você não pode alterar sua própria permissão' });
      return;
    }
    updateRole.mutate({ userId, newRole });
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
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
      // Verificar se email já existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newUserForm.email)
        .single();

      if (existingProfile) {
        toast({
          variant: 'destructive',
          title: 'Email já cadastrado',
          description: 'Este email já está em uso no sistema.',
        });
        setIsCreating(false);
        return;
      }

      // Criar convite
      const { data: invite, error } = await supabase
        .from('user_invites')
        .insert({
          email: newUserForm.email,
          nome: newUserForm.nome,
          role: newUserForm.role,
          cidade_base: newUserForm.cidade_base || null,
          created_by: currentUser?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const inviteLink = `${window.location.origin}/convite/${invite.token}`;
      setGeneratedLink(inviteLink);
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      toast({ title: 'Convite criado com sucesso!' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar convite',
        description: error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setGeneratedLink(null);
    setNewUserForm({ nome: '', email: '', role: 'consultor_rplus', cidade_base: '' });
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/convite/${token}`;
    await navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
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
          <Dialog open={openDialog} onOpenChange={(open) => open ? setOpenDialog(true) : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {generatedLink ? 'Link de Convite Gerado' : 'Convidar Novo Usuário'}
                </DialogTitle>
              </DialogHeader>
              
              {generatedLink ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Compartilhe este link com <strong>{newUserForm.nome}</strong> para que possa criar sua conta:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={generatedLink} readOnly className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={handleCopyLink}>
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este link expira em 7 dias.
                  </p>
                  <Button className="w-full" onClick={handleCloseDialog}>
                    Fechar
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreateInvite} className="space-y-4">
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
                    <Label>Permissão</Label>
                    <Select 
                      value={newUserForm.role} 
                      onValueChange={(v: AppRole) => setNewUserForm({ ...newUserForm, role: v })}
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
                  <div className="space-y-2">
                    <Label>Cidade Base (para rotas)</Label>
                    <Input
                      placeholder="Ex: Piracicaba/SP"
                      value={newUserForm.cidade_base}
                      onChange={(e) => setNewUserForm({ ...newUserForm, cidade_base: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ponto de partida padrão para planejamento de rotas
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isCreating}>
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar Link de Convite'}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="convites">
            Convites Pendentes
            {pendingInvites && pendingInvites.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingInvites.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
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
                      <TableHead>Cidade Base</TableHead>
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
                          <TableCell>
                            {isAdmin ? (
                              editingCidadeBase?.userId === usuario.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingCidadeBase.value}
                                    onChange={(e) => setEditingCidadeBase({ ...editingCidadeBase, value: e.target.value })}
                                    placeholder="Piracicaba/SP"
                                    className="h-8 w-32"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateCidadeBase.mutate({ userId: usuario.id, cidadeBase: editingCidadeBase.value });
                                      } else if (e.key === 'Escape') {
                                        setEditingCidadeBase(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2"
                                    onClick={() => updateCidadeBase.mutate({ userId: usuario.id, cidadeBase: editingCidadeBase.value })}
                                    disabled={updateCidadeBase.isPending}
                                  >
                                    {updateCidadeBase.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'OK'}
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCidadeBase({ userId: usuario.id, value: usuario.cidade_base || '' })}
                                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {usuario.cidade_base || <span className="italic text-muted-foreground/50">Não definida</span>}
                                </button>
                              )
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {usuario.cidade_base || '-'}
                              </span>
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
        </TabsContent>

        <TabsContent value="convites" className="space-y-4">
          {pendingInvites && pendingInvites.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((invite: any) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[invite.role]}>
                          {roleLabels[invite.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyInviteLink(invite.token)}
                            title="Copiar link"
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteInvite.mutate(invite.id)}
                            title="Excluir convite"
                            disabled={deleteInvite.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Link2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold">Nenhum convite pendente</h3>
                <p className="text-muted-foreground">
                  Os convites aceitos ou expirados não aparecem aqui
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
