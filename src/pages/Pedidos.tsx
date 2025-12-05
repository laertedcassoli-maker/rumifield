import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, ShoppingCart, Building2, Loader2, Package, Trash2, Minus, Check, ChevronsUpDown } from 'lucide-react';
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cliente_id: '', observacoes: '' });
  const [itens, setItens] = useState<{ peca_id: string; quantidade: number }[]>([]);

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
    queryKey: ['pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, clientes(nome, fazenda), pedido_itens(*, pecas(nome, codigo))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
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

  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});

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
    createPedido.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Peças</h1>
          <p className="text-muted-foreground">Solicite peças para seus clientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Pedido de Peças</DialogTitle>
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
                                  {item.peca_id ? `${selectedPeca?.codigo} - ${selectedPeca?.nome}` : 'Buscar peça...'}
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
                                          <span className="font-medium">{peca.codigo} - {peca.nome}</span>
                                          {peca.descricao && (
                                            <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                              {peca.descricao}
                                            </span>
                                          )}
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
                        
                        {selectedPeca && (
                          <div className="text-xs text-muted-foreground pl-1">
                            <span className="font-medium">Cód:</span> {selectedPeca.codigo}
                            {selectedPeca.descricao && (
                              <span className="ml-2">• {selectedPeca.descricao}</span>
                            )}
                          </div>
                        )}
                        
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

              <Button type="submit" className="w-full" disabled={createPedido.isPending}>
                {createPedido.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Pedido'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
      ) : (
        <div className="grid gap-4">
          {pedidos?.map((pedido) => (
            <Card key={pedido.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-4 w-4 text-primary" />
                      {pedido.clientes?.nome}
                    </CardTitle>
                    {pedido.clientes?.fazenda && (
                      <p className="text-sm text-muted-foreground">{pedido.clientes.fazenda}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={statusColors[pedido.status]}>
                    {statusLabels[pedido.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {pedido.pedido_itens?.map((item: any) => (
                    <Badge key={item.id} variant="secondary">
                      <Package className="mr-1 h-3 w-3" />
                      {item.pecas?.codigo} x{item.quantidade}
                    </Badge>
                  ))}
                </div>
                {pedido.observacoes && (
                  <p className="text-sm text-muted-foreground">{pedido.observacoes}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Criado em {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {pedido.omie_nf_numero && <span>NF: {pedido.omie_nf_numero}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
