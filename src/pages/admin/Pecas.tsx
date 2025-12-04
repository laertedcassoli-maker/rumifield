import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Package, Loader2, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface Peca {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  omie_codigo: string | null;
  ativo: boolean | null;
  created_at: string;
}

interface PecaForm {
  codigo: string;
  nome: string;
  descricao: string;
}

type SortField = 'codigo' | 'descricao';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

export default function AdminPecas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Peca | null>(null);
  const [deletingPeca, setDeletingPeca] = useState<Peca | null>(null);
  const [form, setForm] = useState<PecaForm>({ codigo: '', nome: '', descricao: '' });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: pecas, isLoading } = useQuery({
    queryKey: ['pecas-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas')
        .select('*')
        .order('codigo');
      if (error) throw error;
      return data as Peca[];
    },
  });

  const filteredAndSortedPecas = useMemo(() => {
    if (!pecas) return [];
    
    let result = pecas.filter((peca) =>
      peca.codigo.toLowerCase().includes(search.toLowerCase()) ||
      peca.descricao?.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [pecas, search, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedPecas.length / ITEMS_PER_PAGE);
  const paginatedPecas = filteredAndSortedPecas.slice(
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

  const createPeca = useMutation({
    mutationFn: async (data: PecaForm) => {
      const { error } = await supabase.from('pecas').insert({
        codigo: data.codigo,
        nome: data.codigo,
        descricao: data.descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      closeDialog();
      toast({ title: 'Peça cadastrada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updatePeca = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PecaForm }) => {
      const { error } = await supabase
        .from('pecas')
        .update({
          codigo: data.codigo,
          nome: data.codigo,
          descricao: data.descricao || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      closeDialog();
      toast({ title: 'Peça atualizada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const deletePeca = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pecas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      setDeleteDialogOpen(false);
      setDeletingPeca(null);
      toast({ title: 'Peça excluída com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPeca(null);
    setForm({ codigo: '', nome: '', descricao: '' });
  };

  const openEditDialog = (peca: Peca) => {
    setEditingPeca(peca);
    setForm({
      codigo: peca.codigo,
      nome: peca.nome,
      descricao: peca.descricao || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (peca: Peca) => {
    setDeletingPeca(peca);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim()) return;

    if (editingPeca) {
      updatePeca.mutate({ id: editingPeca.id, data: form });
    } else {
      createPeca.mutate(form);
    }
  };

  const isPending = createPeca.isPending || updatePeca.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Peças</h1>
          <p className="text-muted-foreground">Gerencie o catálogo de peças do sistema</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Peça
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPeca ? 'Editar Peça' : 'Cadastrar Peça'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Cod OnFarm *</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Digite o código OnFarm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Digite a descrição da peça"
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingPeca ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código ou descrição..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedPecas.length > 0 ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('codigo')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Cod OnFarm {getSortIcon('codigo')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('descricao')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Descrição {getSortIcon('descricao')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPecas.map((peca) => (
                  <TableRow key={peca.id}>
                    <TableCell className="font-medium">{peca.codigo}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {peca.descricao || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(peca)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(peca)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedPecas.length)} de {filteredAndSortedPecas.length} registros
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
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">
              {search ? 'Nenhuma peça encontrada' : 'Nenhuma peça cadastrada'}
            </h3>
            <p className="text-muted-foreground">
              {search ? 'Tente outra busca' : 'Clique em "Nova Peça" para adicionar'}
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a peça "{deletingPeca?.codigo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPeca(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPeca && deletePeca.mutate(deletingPeca.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePeca.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
