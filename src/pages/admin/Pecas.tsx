import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Package, Loader2, Pencil, Trash2 } from 'lucide-react';
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

export default function AdminPecas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Peca | null>(null);
  const [deletingPeca, setDeletingPeca] = useState<Peca | null>(null);
  const [form, setForm] = useState<PecaForm>({ codigo: '', nome: '', descricao: '' });

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

  const createPeca = useMutation({
    mutationFn: async (data: PecaForm) => {
      const { error } = await supabase.from('pecas').insert({
        codigo: data.codigo,
        nome: data.codigo, // Using codigo as nome since it's required
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pecas && pecas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pecas.map((peca) => (
            <Card key={peca.id} className="group">
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{peca.codigo}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {peca.descricao || 'Sem descrição'}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhuma peça cadastrada</h3>
            <p className="text-muted-foreground">Clique em "Nova Peça" para adicionar</p>
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
