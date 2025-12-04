import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, Loader2, Pencil, Trash2, Home } from 'lucide-react';
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
  created_at: string;
  updated_at: string;
}

interface ClienteForm {
  nome: string;
  fazenda: string;
  cod_imilk: string;
}

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
  });

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

  const createCliente = useMutation({
    mutationFn: async (data: ClienteForm) => {
      const { error } = await supabase.from('clientes').insert({
        nome: data.nome,
        fazenda: data.fazenda || null,
        cod_imilk: data.cod_imilk || null,
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

  const closeDialog = () => {
    setOpen(false);
    setEditingCliente(null);
    setForm({ nome: '', fazenda: '', cod_imilk: '' });
  };

  const openEditDialog = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setForm({
      nome: cliente.nome,
      fazenda: cliente.fazenda || '',
      cod_imilk: cliente.cod_imilk || '',
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : clientes?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum cliente cadastrado</h3>
            <p className="text-muted-foreground">Clique em "Novo Cliente" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientes?.map((cliente) => (
            <Card key={cliente.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-4 w-4 text-primary" />
                    {cliente.nome}
                  </CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cliente.fazenda && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Home className="h-3 w-3" />
                    {cliente.fazenda}
                  </div>
                )}
                {cliente.cod_imilk && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Cod Imilk:</span> {cliente.cod_imilk}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
