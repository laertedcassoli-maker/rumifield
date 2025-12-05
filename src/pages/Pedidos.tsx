import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ShoppingCart, Loader2, Package, Trash2, Minus, Check, ChevronsUpDown, ArrowUpDown, Search, X, Eye, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  solicitado: 'bg-info/10 text-info border-info/20',
  processamento: 'bg-warning/10 text-warning border-warning/20',
  faturado: 'bg-primary/10 text-primary border-primary/20',
  enviado: 'bg-success/10 text-success border-success/20',
  entregue: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  solicitado: 'Solicitado',
  processamento: 'Em Processamento',
  faturado: 'Faturado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

export default function Pedidos() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<any>(null);
  const [form, setForm] = useState({ cliente_id: '', observacoes: '' });
  const [itens, setItens] = useState<{ peca_id: string; quantidade: number }[]>([]);
  const [viewAll, setViewAll] = useState(false);
  
  const isAdmin = role === 'admin' || role === 'gestor';

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: pecas } = useQuery({
    queryKey: ['pecas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pecas').select('*').eq('ativo', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ['pedidos', viewAll, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nome, fazenda), pedido_itens(*, pecas(nome, codigo))')
        .order('created_at', { ascending: false });
      
      // Se não for admin ou se for admin mas não quer ver todos, filtra pelo usuário
      if (!isAdmin || !viewAll) {
        query = query.eq('solicitante_id', user?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Se admin está vendo todos, busca os profiles dos solicitantes
      if (isAdmin && viewAll && data && data.length > 0) {
        const solicitanteIds = [...new Set(data.map(p => p.solicitante_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome, email')
          .in('id', solicitanteIds);
        
        // Mapeia os profiles para os pedidos
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(pedido => ({
          ...pedido,
          solicitante: profilesMap.get(pedido.solicitante_id) || null
        }));
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const createPedido = useMutation({
    mutationFn: async () => {
      if (!user?.id || !form.cliente_id || itens.length === 0) return;

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          solicitante_id: user.id,
          cliente_id: form.cliente_id,
          observacoes: form.observacoes,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const { error: itensError } = await supabase.from('pedido_itens').insert(
        itens.map((item) => ({
          pedido_id: pedido.id,
          peca_id: item.peca_id,
          quantidade: item.quantidade,
        }))
      );

      if (itensError) throw itensError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setOpen(false);
      setForm({ cliente_id: '', observacoes: '' });
      setItens([]);
      toast({ title: 'Pedido criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao criar pedido', description: error.message });
    },
  });

  const updatePedido = useMutation({
    mutationFn: async () => {
      if (!editingPedido || !form.cliente_id || itens.length === 0) return;

      // Atualizar o pedido
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({
          cliente_id: form.cliente_id,
          observacoes: form.observacoes,
        })
        .eq('id', editingPedido.id);

      if (pedidoError) throw pedidoError;

      // Deletar itens antigos
      const { error: deleteError } = await supabase
        .from('pedido_itens')
        .delete()
        .eq('pedido_id', editingPedido.id);

      if (deleteError) throw deleteError;

      // Inserir novos itens
      const { error: itensError } = await supabase.from('pedido_itens').insert(
        itens.map((item) => ({
          pedido_id: editingPedido.id,
          peca_id: item.peca_id,
          quantidade: item.quantidade,
        }))
      );

      if (itensError) throw itensError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setOpen(false);
      setEditingPedido(null);
      setForm({ cliente_id: '', observacoes: '' });
      setItens([]);
      toast({ title: 'Pedido atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar pedido', description: error.message });
    },
  });

  const handleEditPedido = (pedido: any) => {
    setEditingPedido(pedido);
    setForm({
      cliente_id: pedido.cliente_id,
      observacoes: pedido.observacoes || '',
    });
    setItens(
      pedido.pedido_itens?.map((item: any) => ({
        peca_id: item.peca_id,
        quantidade: item.quantidade,
      })) || []
    );
    setOpen(true);
  };

  const handleCloseDialog = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingPedido(null);
      setForm({ cliente_id: '', observacoes: '' });
      setItens([]);
    }
  };

  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'created_at' | 'cliente' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedPedidos = useMemo(() => {
    if (!pedidos) return [];
    
    let filtered = pedidos.filter(pedido => {
      const matchesSearch = searchTerm === '' || 
        pedido.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.clientes?.fazenda?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.pedido_itens?.some((item: any) => 
          item.pecas?.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesStatus = statusFilter === 'all' || pedido.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'cliente') {
        comparison = (a.clientes?.nome || '').localeCompare(b.clientes?.nome || '');
      } else if (sortField === 'status') {
        const statusOrder = ['solicitado', 'processamento', 'faturado', 'enviado', 'entregue'];
        comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [pedidos, searchTerm, statusFilter, sortField, sortOrder]);

  const toggleSort = (field: 'created_at' | 'cliente' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const addItem = () => {
    setItens([...itens, { peca_id: '', quantidade: 1 }]);
  };

  const updateItem = (index: number, field: 'peca_id' | 'quantidade', value: string | number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    setItens(newItens);
  };

  const incrementQuantity = (index: number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], quantidade: newItens[index].quantidade + 1 };
    setItens(newItens);
  };

  const decrementQuantity = (index: number) => {
    const newItens = [...itens];
    if (newItens[index].quantidade > 1) {
      newItens[index] = { ...newItens[index], quantidade: newItens[index].quantidade - 1 };
      setItens(newItens);
    }
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const getPecaLabel = (pecaId: string) => {
    const peca = pecas?.find(p => p.id === pecaId);
    return peca ? `${peca.codigo} - ${peca.nome}` : 'Selecione a peça';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    if (itens.length === 0 || itens.some((i) => !i.peca_id)) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos uma peça válida' });
      return;
    }
    if (editingPedido) {
      updatePedido.mutate();
    } else {
      createPedido.mutate();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Peças</h1>
          <p className="text-muted-foreground">
            {isAdmin && viewAll ? 'Todos os pedidos' : 'Seus pedidos'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button 
              variant={viewAll ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setViewAll(!viewAll)}
            >
              {viewAll ? 'Ver meus pedidos' : 'Ver todos'}
            </Button>
          )}
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPedido ? 'Editar Pedido' : 'Novo Pedido de Peças'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente / Fazenda</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome} {cliente.fazenda && `- ${cliente.fazenda}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Peças</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {itens.map((item, index) => {
                    const selectedPeca = pecas?.find(p => p.id === item.peca_id);
                    const selectedPecaIds = itens.map(i => i.peca_id).filter(id => id !== item.peca_id);
                    const availablePecas = pecas?.filter(p => !selectedPecaIds.includes(p.id));
                    
                    return (
                      <div key={index} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <Popover 
                            open={openPopovers[index]} 
                            onOpenChange={(open) => setOpenPopovers({ ...openPopovers, [index]: open })}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="flex-1 justify-between font-normal"
                              >
                                <span className="truncate">
                                  {item.peca_id 
                                    ? `${selectedPeca?.codigo} - ${selectedPeca?.descricao || selectedPeca?.nome}` 
                                    : 'Buscar peça...'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar por código, nome ou descrição..." />
                                <CommandList>
                                  <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                                  <CommandGroup>
                                    {availablePecas?.map((peca) => (
                                      <CommandItem
                                        key={peca.id}
                                        value={`${peca.codigo} ${peca.nome} ${peca.descricao || ''}`}
                                        onSelect={() => {
                                          updateItem(index, 'peca_id', peca.id);
                                          setOpenPopovers({ ...openPopovers, [index]: false });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.peca_id === peca.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{peca.codigo} - {peca.descricao || peca.nome}</span>
                                    </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Quantidade:</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => decrementQuantity(index)}
                              disabled={item.quantidade <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantidade}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => incrementQuantity(index)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações adicionais..."
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createPedido.isPending || updatePedido.isPending}>
                {(createPedido.isPending || updatePedido.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingPedido ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Pedido'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, fazenda ou código da peça..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="solicitado">Solicitado</SelectItem>
                <SelectItem value="processamento">Em Processamento</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || statusFilter !== 'all') && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pedidos?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum pedido criado</h3>
            <p className="text-muted-foreground">Clique em "Novo Pedido" para solicitar peças.</p>
          </CardContent>
        </Card>
      ) : filteredAndSortedPedidos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => toggleSort('created_at')}
                  >
                    Data
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                {isAdmin && viewAll && (
                  <TableHead>Solicitante</TableHead>
                )}
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => toggleSort('cliente')}
                  >
                    Cliente / Fazenda
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Peças</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => toggleSort('status')}
                  >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>NF</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPedidos.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    <span className="block text-xs text-muted-foreground">
                      {format(new Date(pedido.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                  </TableCell>
                  {isAdmin && viewAll && (
                    <TableCell>
                      <div className="font-medium">{(pedido as any).solicitante?.nome || '-'}</div>
                      <div className="text-xs text-muted-foreground">{(pedido as any).solicitante?.email}</div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium">{pedido.clientes?.nome}</div>
                    {pedido.clientes?.fazenda && (
                      <div className="text-sm text-muted-foreground">{pedido.clientes.fazenda}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-auto p-1 gap-1.5">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{pedido.pedido_itens?.length || 0} {pedido.pedido_itens?.length === 1 ? 'item' : 'itens'}</span>
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Itens do Pedido</p>
                          <div className="space-y-1.5">
                            {pedido.pedido_itens?.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                                <div>
                                  <span className="font-medium">{item.pecas?.codigo}</span>
                                  <span className="text-muted-foreground"> - {item.pecas?.nome}</span>
                                </div>
                                <span className="font-medium">x{item.quantidade}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[pedido.status]}>
                      {statusLabels[pedido.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pedido.omie_nf_numero || '-'}
                  </TableCell>
                  <TableCell>
                    {pedido.status === 'solicitado' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditPedido(pedido)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
