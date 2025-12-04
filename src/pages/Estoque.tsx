import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Beaker, Building2, Loader2, Save, ChevronsUpDown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Estoque() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [clienteOpen, setClienteOpen] = useState(false);

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*').order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ['produtos-quimicos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos_quimicos').select('*').eq('ativo', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: estoque, isLoading } = useQuery({
    queryKey: ['estoque', selectedCliente],
    queryFn: async () => {
      if (!selectedCliente) return [];
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select('*, produtos_quimicos(nome, unidade)')
        .eq('cliente_id', selectedCliente);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCliente,
  });

  const saveEstoque = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !produtos) return;

      const updates = produtos.map((produto) => ({
        cliente_id: selectedCliente,
        produto_id: produto.id,
        quantidade: parseFloat(quantidades[produto.id] || '0'),
        atualizado_por: user?.id,
        data_atualizacao: new Date().toISOString(),
      }));

      const { error } = await supabase.from('estoque_cliente').upsert(updates, {
        onConflict: 'cliente_id,produto_id',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
      toast({ title: 'Estoque atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    },
  });

  // Atualizar quantidades quando estoque carregar
  useEffect(() => {
    if (estoque) {
      const newQuantidades: Record<string, string> = {};
      estoque.forEach((item) => {
        newQuantidades[item.produto_id] = item.quantidade.toString();
      });
      setQuantidades(newQuantidades);
    }
  }, [estoque]);

  const clienteSelecionado = clientes?.find((c) => c.id === selectedCliente);

  const getClienteLabel = (cliente: typeof clientes extends (infer T)[] ? T : never) => {
    return cliente.fazenda ? `${cliente.nome} - ${cliente.fazenda}` : cliente.nome;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Controle de Estoque</h1>
        <p className="text-muted-foreground">Registre o estoque de produtos químicos por cliente</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione o Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={clienteOpen}
                className="w-full justify-between font-normal"
              >
                {selectedCliente && clienteSelecionado
                  ? getClienteLabel(clienteSelecionado)
                  : "Buscar cliente / fazenda..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Digite para buscar..." />
                <CommandList>
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {clientes?.map((cliente) => (
                      <CommandItem
                        key={cliente.id}
                        value={getClienteLabel(cliente)}
                        onSelect={() => {
                          setSelectedCliente(cliente.id);
                          setClienteOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCliente === cliente.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{cliente.nome}</span>
                          {cliente.fazenda && (
                            <span className="text-xs text-muted-foreground">{cliente.fazenda}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {selectedCliente && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {clienteSelecionado?.nome}
              </CardTitle>
              {clienteSelecionado?.fazenda && (
                <p className="text-sm text-muted-foreground">{clienteSelecionado.fazenda}</p>
              )}
            </div>
            <Button onClick={() => saveEstoque.mutate()} disabled={saveEstoque.isPending}>
              {saveEstoque.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              produtos?.map((produto) => {
                const estoqueItem = estoque?.find((e) => e.produto_id === produto.id);
                return (
                  <div key={produto.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Beaker className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{produto.nome}</p>
                      <p className="text-sm text-muted-foreground">{produto.descricao}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-24 text-right"
                        value={quantidades[produto.id] || estoqueItem?.quantidade || ''}
                        onChange={(e) =>
                          setQuantidades((prev) => ({ ...prev, [produto.id]: e.target.value }))
                        }
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground w-12">{produto.unidade}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
