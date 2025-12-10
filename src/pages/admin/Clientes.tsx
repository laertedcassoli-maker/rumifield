import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, Loader2, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Cliente {
  id: string;
  nome: string;
  fazenda: string | null;
  cod_imilk: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  status: string;
  data_ativacao_rumiflow: string | null;
  created_at: string;
  updated_at: string;
}

interface ClienteForm {
  nome: string;
  fazenda: string;
  cod_imilk: string;
  status: string;
  data_ativacao_rumiflow: Date | undefined;
}

type SortField = 'nome' | 'fazenda' | 'cod_imilk' | 'status';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const statusOptions = [
  { value: 'ativo', label: 'Ativo', color: 'bg-success text-success-foreground' },
  { value: 'inativo', label: 'Inativo', color: 'bg-muted text-muted-foreground' },
  { value: 'suspenso', label: 'Suspenso', color: 'bg-warning text-warning-foreground' },
];

export default function AdminClientes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteForm>({
    nome: '',
    fazenda: '',
    cod_imilk: '',
    status: 'ativo',
    data_ativacao_rumiflow: undefined,
  });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const filteredAndSortedClientes = useMemo(() => {
    if (!clientes) return [];
    
    let result = clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      cliente.fazenda?.toLowerCase().includes(search.toLowerCase()) ||
      cliente.cod_imilk?.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [clientes, search, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedClientes.length / ITEMS_PER_PAGE);
  const paginatedClientes = filteredAndSortedClientes.slice(
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

  const createCliente = useMutation({
    mutationFn: async (data: ClienteForm) => {
      const { error } = await supabase.from('clientes').insert({
        nome: data.nome,
        fazenda: data.fazenda || null,
        cod_imilk: data.cod_imilk || null,
        status: data.status,
        data_ativacao_rumiflow: data.data_ativacao_rumiflow ? format(data.data_ativacao_rumiflow, 'yyyy-MM-dd') : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      closeDialog();
      toast({ title: 'Cliente cadastrado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: error.message });
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClienteForm }) => {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: data.nome,
          fazenda: data.fazenda || null,
          cod_imilk: data.cod_imilk || null,
          status: data.status,
          data_ativacao_rumiflow: data.data_ativacao_rumiflow ? format(data.data_ativacao_rumiflow, 'yyyy-MM-dd') : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      closeDialog();
      toast({ title: 'Cliente atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setDeleteDialogOpen(false);
      setDeletingCliente(null);
      toast({ title: 'Cliente excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const syncIlmilk = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-imilk-clientes');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ 
        title: 'Sincronização concluída!',
        description: `${data.created} novos, ${data.updated} atualizados de ${data.total} clientes`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro na sincronização', description: error.message });
    },
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingCliente(null);
    setForm({ nome: '', fazenda: '', cod_imilk: '', status: 'ativo', data_ativacao_rumiflow: undefined });
  };

  const openEditDialog = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setForm({
      nome: cliente.nome,
      fazenda: cliente.fazenda || '',
      cod_imilk: cliente.cod_imilk || '',
      status: cliente.status || 'ativo',
      data_ativacao_rumiflow: cliente.data_ativacao_rumiflow ? new Date(cliente.data_ativacao_rumiflow) : undefined,
    });
    setOpen(true);
  };

  const openDeleteDialog = (cliente: Cliente) => {
    setDeletingCliente(cliente);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome do produtor é obrigatório' });
      return;
    }

    if (editingCliente) {
      updateCliente.mutate({ id: editingCliente.id, data: form });
    } else {
      createCliente.mutate(form);
    }
  };

  const isPending = createCliente.isPending || updateCliente.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os produtores e fazendas</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncIlmilk.mutate()}
            disabled={syncIlmilk.isPending}
          >
            {syncIlmilk.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar iMilk
          </Button>
          <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
            else setOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Produtor *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome do produtor"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fazenda">Nome da Fazenda</Label>
                <Input
                  id="fazenda"
                  value={form.fazenda}
                  onChange={(e) => setForm({ ...form, fazenda: e.target.value })}
                  placeholder="Nome da fazenda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cod_imilk">Cod Imilk</Label>
                <Input
                  id="cod_imilk"
                  value={form.cod_imilk}
                  onChange={(e) => setForm({ ...form, cod_imilk: e.target.value })}
                  placeholder="Código Imilk"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Ativação RumiFlow</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.data_ativacao_rumiflow && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {form.data_ativacao_rumiflow ? (
                          format(form.data_ativacao_rumiflow, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          "Selecione"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={form.data_ativacao_rumiflow}
                        onSelect={(date) => setForm({ ...form, data_ativacao_rumiflow: date })}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingCliente ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Cliente'
                )}
              </Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, fazenda ou código..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedClientes.length > 0 ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('nome')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Nome Produtor {getSortIcon('nome')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('fazenda')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Nome da Fazenda {getSortIcon('fazenda')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('cod_imilk')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Cod Imilk {getSortIcon('cod_imilk')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('status')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Status {getSortIcon('status')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClientes.map((cliente) => {
                  const statusOption = statusOptions.find(s => s.value === cliente.status) || statusOptions[0];
                  return (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {cliente.fazenda || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cliente.cod_imilk || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", statusOption.color)}>
                        {statusOption.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(cliente)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(cliente)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedClientes.length)} de {filteredAndSortedClientes.length} registros
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
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-muted-foreground">
              {search ? 'Tente outra busca' : 'Clique em "Novo Cliente" para começar.'}
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{deletingCliente?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingCliente(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCliente && deleteCliente.mutate(deletingCliente.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
