import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Pencil, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProdutoSortField = 'nome' | 'unidade' | 'descricao';
type PecaSortField = 'codigo' | 'nome' | 'omie_codigo' | 'descricao';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

interface ProdutoFormData {
  id?: string;
  nome: string;
  unidade: string;
  descricao: string;
  litros_por_vaca_mes: number;
}

interface PecaFormData {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  omie_codigo: string;
}

export default function AdminConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [produtoOpen, setProdutoOpen] = useState(false);
  const [pecaOpen, setPecaOpen] = useState(false);
  const [produtoForm, setProdutoForm] = useState<ProdutoFormData>({ nome: '', unidade: 'litros', descricao: '', litros_por_vaca_mes: 0 });
  const [pecaForm, setPecaForm] = useState<PecaFormData>({ codigo: '', nome: '', descricao: '', omie_codigo: '' });
  const [isEditingProduto, setIsEditingProduto] = useState(false);
  const [isEditingPeca, setIsEditingPeca] = useState(false);
  const [isSyncingOmie, setIsSyncingOmie] = useState(false);

  // Search states
  const [produtoSearch, setProdutoSearch] = useState('');
  const [pecaSearch, setPecaSearch] = useState('');

  // Sort states
  const [produtoSortField, setProdutoSortField] = useState<ProdutoSortField>('nome');
  const [produtoSortDirection, setProdutoSortDirection] = useState<SortDirection>('asc');
  const [pecaSortField, setPecaSortField] = useState<PecaSortField>('codigo');
  const [pecaSortDirection, setPecaSortDirection] = useState<SortDirection>('asc');

  // Pagination states
  const [produtoPage, setProdutoPage] = useState(1);
  const [pecaPage, setPecaPage] = useState(1);

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

  // Filtered and sorted produtos
  const filteredProdutos = useMemo(() => {
    if (!produtos) return [];
    let filtered = produtos.filter(p =>
      p.nome.toLowerCase().includes(produtoSearch.toLowerCase()) ||
      (p.descricao?.toLowerCase().includes(produtoSearch.toLowerCase()))
    );
    filtered.sort((a, b) => {
      const aVal = (a[produtoSortField] || '').toString().toLowerCase();
      const bVal = (b[produtoSortField] || '').toString().toLowerCase();
      return produtoSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [produtos, produtoSearch, produtoSortField, produtoSortDirection]);

  const paginatedProdutos = useMemo(() => {
    const start = (produtoPage - 1) * ITEMS_PER_PAGE;
    return filteredProdutos.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProdutos, produtoPage]);

  const totalProdutoPages = Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE);

  // Filtered and sorted pecas
  const filteredPecas = useMemo(() => {
    if (!pecas) return [];
    let filtered = pecas.filter(p =>
      p.codigo.toLowerCase().includes(pecaSearch.toLowerCase()) ||
      p.nome.toLowerCase().includes(pecaSearch.toLowerCase()) ||
      (p.descricao?.toLowerCase().includes(pecaSearch.toLowerCase()))
    );
    filtered.sort((a, b) => {
      const aVal = (a[pecaSortField] || '').toString().toLowerCase();
      const bVal = (b[pecaSortField] || '').toString().toLowerCase();
      return pecaSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [pecas, pecaSearch, pecaSortField, pecaSortDirection]);

  const paginatedPecas = useMemo(() => {
    const start = (pecaPage - 1) * ITEMS_PER_PAGE;
    return filteredPecas.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPecas, pecaPage]);

  const totalPecaPages = Math.ceil(filteredPecas.length / ITEMS_PER_PAGE);

  const handleProdutoSort = (field: ProdutoSortField) => {
    if (produtoSortField === field) {
      setProdutoSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProdutoSortField(field);
      setProdutoSortDirection('asc');
    }
    setProdutoPage(1);
  };

  const handlePecaSort = (field: PecaSortField) => {
    if (pecaSortField === field) {
      setPecaSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPecaSortField(field);
      setPecaSortDirection('asc');
    }
    setPecaPage(1);
  };

  const getSortIcon = (field: string, currentField: string, direction: SortDirection) => {
    if (field !== currentField) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const createProduto = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      const { error } = await supabase.from('produtos_quimicos').insert({
        nome: data.nome,
        unidade: data.unidade,
        descricao: data.descricao,
        litros_por_vaca_mes: data.litros_por_vaca_mes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-config'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-quimicos'] });
      closeProdutoDialog();
      toast({ title: 'Produto cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updateProduto = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      if (!data.id) throw new Error('ID do produto não informado');
      const { error } = await supabase.from('produtos_quimicos').update({
        nome: data.nome,
        unidade: data.unidade,
        descricao: data.descricao,
        litros_por_vaca_mes: data.litros_por_vaca_mes,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-config'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-quimicos'] });
      closeProdutoDialog();
      toast({ title: 'Produto atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const createPeca = useMutation({
    mutationFn: async (data: PecaFormData) => {
      const { error } = await supabase.from('pecas').insert({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao,
        omie_codigo: data.omie_codigo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      closePecaDialog();
      toast({ title: 'Peça cadastrada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updatePeca = useMutation({
    mutationFn: async (data: PecaFormData) => {
      if (!data.id) throw new Error('ID da peça não informado');
      const { error } = await supabase.from('pecas').update({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao,
        omie_codigo: data.omie_codigo,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      closePecaDialog();
      toast({ title: 'Peça atualizada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const openNewProduto = () => {
    setProdutoForm({ nome: '', unidade: 'litros', descricao: '', litros_por_vaca_mes: 0 });
    setIsEditingProduto(false);
    setProdutoOpen(true);
  };

  const openEditProduto = (produto: typeof produtos extends (infer T)[] ? T : never) => {
    setProdutoForm({
      id: produto.id,
      nome: produto.nome,
      unidade: produto.unidade,
      descricao: produto.descricao || '',
      litros_por_vaca_mes: produto.litros_por_vaca_mes || 0,
    });
    setIsEditingProduto(true);
    setProdutoOpen(true);
  };

  const closeProdutoDialog = () => {
    setProdutoOpen(false);
    setProdutoForm({ nome: '', unidade: 'litros', descricao: '', litros_por_vaca_mes: 0 });
    setIsEditingProduto(false);
  };

  const openNewPeca = () => {
    setPecaForm({ codigo: '', nome: '', descricao: '', omie_codigo: '' });
    setIsEditingPeca(false);
    setPecaOpen(true);
  };

  const openEditPeca = (peca: typeof pecas extends (infer T)[] ? T : never) => {
    setPecaForm({
      id: peca.id,
      codigo: peca.codigo,
      nome: peca.nome,
      descricao: peca.descricao || '',
      omie_codigo: peca.omie_codigo || '',
    });
    setIsEditingPeca(true);
    setPecaOpen(true);
  };

  const closePecaDialog = () => {
    setPecaOpen(false);
    setPecaForm({ codigo: '', nome: '', descricao: '', omie_codigo: '' });
    setIsEditingPeca(false);
  };

  const handleProdutoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoForm.nome.trim()) return;
    if (isEditingProduto) {
      updateProduto.mutate(produtoForm);
    } else {
      createProduto.mutate(produtoForm);
    }
  };

  const handlePecaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pecaForm.codigo.trim() || !pecaForm.nome.trim()) return;
    if (isEditingPeca) {
      updatePeca.mutate(pecaForm);
    } else {
      createPeca.mutate(pecaForm);
    }
  };

  const isProdutoSaving = createProduto.isPending || updateProduto.isPending;
  const isPecaSaving = createPeca.isPending || updatePeca.isPending;

  const handleSyncOmiePecas = async () => {
    setIsSyncingOmie(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-omie-pecas');
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: 'Sincronização concluída!',
          description: `${data.created} criadas, ${data.updated} atualizadas de ${data.total} peças`,
        });
        queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
        queryClient.invalidateQueries({ queryKey: ['pecas'] });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: error.message || 'Não foi possível sincronizar com Omie',
      });
    } finally {
      setIsSyncingOmie(false);
    }
  };

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
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou descrição..."
                value={produtoSearch}
                onChange={(e) => { setProdutoSearch(e.target.value); setProdutoPage(1); }}
                className="pl-10"
              />
            </div>
            <Button onClick={openNewProduto}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </div>

          {/* Produto Dialog */}
          <Dialog open={produtoOpen} onOpenChange={(open) => !open && closeProdutoDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditingProduto ? 'Editar Produto Químico' : 'Cadastrar Produto Químico'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleProdutoSubmit} className="space-y-4">
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
                <div className="space-y-2">
                  <Label>Consumo por Vaca (L/vaca.mês)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={produtoForm.litros_por_vaca_mes}
                    onChange={(e) => setProdutoForm({ ...produtoForm, litros_por_vaca_mes: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isProdutoSaving}>
                  {isProdutoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditingProduto ? 'Salvar Alterações' : 'Cadastrar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {loadingProdutos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleProdutoSort('nome')} className="hover:bg-transparent p-0">
                          Nome {getSortIcon('nome', produtoSortField, produtoSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleProdutoSort('unidade')} className="hover:bg-transparent p-0">
                          Unidade {getSortIcon('unidade', produtoSortField, produtoSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleProdutoSort('descricao')} className="hover:bg-transparent p-0">
                          Descrição {getSortIcon('descricao', produtoSortField, produtoSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProdutos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProdutos.map((produto) => (
                        <TableRow key={produto.id}>
                          <TableCell className="font-medium">{produto.nome}</TableCell>
                          <TableCell>{produto.unidade}</TableCell>
                          <TableCell className="text-muted-foreground">{produto.descricao || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditProduto(produto)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalProdutoPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((produtoPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(produtoPage * ITEMS_PER_PAGE, filteredProdutos.length)} de {filteredProdutos.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setProdutoPage(p => p - 1)} disabled={produtoPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Página {produtoPage} de {totalProdutoPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setProdutoPage(p => p + 1)} disabled={produtoPage === totalProdutoPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="pecas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nome ou descrição..."
                value={pecaSearch}
                onChange={(e) => { setPecaSearch(e.target.value); setPecaPage(1); }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSyncOmiePecas} disabled={isSyncingOmie}>
                {isSyncingOmie ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar Omie
              </Button>
              <Button onClick={openNewPeca}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Peça
              </Button>
            </div>
          </div>

          {/* Peça Dialog */}
          <Dialog open={pecaOpen} onOpenChange={(open) => !open && closePecaDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditingPeca ? 'Editar Peça' : 'Cadastrar Peça'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePecaSubmit} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={isPecaSaving}>
                  {isPecaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditingPeca ? 'Salvar Alterações' : 'Cadastrar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {loadingPecas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('codigo')} className="hover:bg-transparent p-0">
                          Código {getSortIcon('codigo', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('nome')} className="hover:bg-transparent p-0">
                          Nome {getSortIcon('nome', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('omie_codigo')} className="hover:bg-transparent p-0">
                          Cód. Omie {getSortIcon('omie_codigo', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('descricao')} className="hover:bg-transparent p-0">
                          Descrição {getSortIcon('descricao', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPecas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhuma peça encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPecas.map((peca) => (
                        <TableRow key={peca.id}>
                          <TableCell className="font-medium">{peca.codigo}</TableCell>
                          <TableCell>{peca.nome}</TableCell>
                          <TableCell>{peca.omie_codigo || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{peca.descricao || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditPeca(peca)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPecaPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((pecaPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(pecaPage * ITEMS_PER_PAGE, filteredPecas.length)} de {filteredPecas.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPecaPage(p => p - 1)} disabled={pecaPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Página {pecaPage} de {totalPecaPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPecaPage(p => p + 1)} disabled={pecaPage === totalPecaPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
