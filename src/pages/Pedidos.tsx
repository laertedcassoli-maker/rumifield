import { useState } from 'react';
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
import { Plus, ShoppingCart, Building2, Loader2, Package, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  const addItem = () => {
    setItens([...itens, { peca_id: '', quantidade: 1 }]);
  };

  const updateItem = (index: number, field: 'peca_id' | 'quantidade', value: string | number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    setItens(newItens);
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
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
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {itens.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={item.peca_id}
                        onValueChange={(v) => updateItem(index, 'peca_id', v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione a peça" />
                        </SelectTrigger>
                        <SelectContent>
                          {pecas?.map((peca) => (
                            <SelectItem key={peca.id} value={peca.id}>
                              {peca.codigo} - {peca.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        className="w-20"
                        value={item.quantidade}
                        onChange={(e) => updateItem(index, 'quantidade', parseInt(e.target.value) || 1)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
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
