import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Beaker, Package, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [produtoOpen, setProdutoOpen] = useState(false);
  const [pecaOpen, setPecaOpen] = useState(false);
  const [produtoForm, setProdutoForm] = useState({ nome: '', unidade: 'litros', descricao: '' });
  const [pecaForm, setPecaForm] = useState({ codigo: '', nome: '', descricao: '', omie_codigo: '' });

  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos_quimicos').select('*').order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: pecas, isLoading: loadingPecas } = useQuery({
    queryKey: ['pecas-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pecas').select('*').order('codigo');
      if (error) throw error;
      return data;
    },
  });

  const createProduto = useMutation({
    mutationFn: async (data: typeof produtoForm) => {
      const { error } = await supabase.from('produtos_quimicos').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-config'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-quimicos'] });
      setProdutoOpen(false);
      setProdutoForm({ nome: '', unidade: 'litros', descricao: '' });
      toast({ title: 'Produto cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const createPeca = useMutation({
    mutationFn: async (data: typeof pecaForm) => {
      const { error } = await supabase.from('pecas').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      setPecaOpen(false);
      setPecaForm({ codigo: '', nome: '', descricao: '', omie_codigo: '' });
      toast({ title: 'Peça cadastrada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie produtos químicos e catálogo de peças</p>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos Químicos</TabsTrigger>
          <TabsTrigger value="pecas">Catálogo de Peças</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={produtoOpen} onOpenChange={setProdutoOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Produto Químico</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!produtoForm.nome.trim()) return;
                    createProduto.mutate(produtoForm);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={produtoForm.nome}
                      onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })}
                      placeholder="Nome do produto"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Input
                      value={produtoForm.unidade}
                      onChange={(e) => setProdutoForm({ ...produtoForm, unidade: e.target.value })}
                      placeholder="litros, kg, unidade..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={produtoForm.descricao}
                      onChange={(e) => setProdutoForm({ ...produtoForm, descricao: e.target.value })}
                      placeholder="Descrição do produto"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createProduto.isPending}>
                    {createProduto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingProdutos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {produtos?.map((produto) => (
                <Card key={produto.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Beaker className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{produto.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {produto.descricao || 'Sem descrição'} • {produto.unidade}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pecas" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={pecaOpen} onOpenChange={setPecaOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Peça
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Peça</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!pecaForm.codigo.trim() || !pecaForm.nome.trim()) return;
                    createPeca.mutate(pecaForm);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código *</Label>
                      <Input
                        value={pecaForm.codigo}
                        onChange={(e) => setPecaForm({ ...pecaForm, codigo: e.target.value })}
                        placeholder="PC-001"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código Omie</Label>
                      <Input
                        value={pecaForm.omie_codigo}
                        onChange={(e) => setPecaForm({ ...pecaForm, omie_codigo: e.target.value })}
                        placeholder="Código no Omie"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={pecaForm.nome}
                      onChange={(e) => setPecaForm({ ...pecaForm, nome: e.target.value })}
                      placeholder="Nome da peça"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={pecaForm.descricao}
                      onChange={(e) => setPecaForm({ ...pecaForm, descricao: e.target.value })}
                      placeholder="Descrição da peça"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createPeca.isPending}>
                    {createPeca.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingPecas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pecas?.map((peca) => (
                <Card key={peca.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                      <Package className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{peca.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {peca.codigo} {peca.omie_codigo && `• Omie: ${peca.omie_codigo}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
