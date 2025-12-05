import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Beaker, Building2, Loader2, Save, ChevronsUpDown, Check, Minus, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const VOLUME_GALAO = 50; // Litros

interface EstoqueItem {
  produtoId: string;
  galoesCheios: number;
  galaoEmUso: boolean;
  nivelGalaoParcial: number; // 0, 25, 50, 75
}

export default function Estoque() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [estoqueItems, setEstoqueItems] = useState<Record<string, EstoqueItem>>({});
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

  // Validação: verifica se todos os produtos têm estoque informado
  const isEstoqueCompleto = () => {
    if (!produtos) return false;
    return produtos.every((produto) => {
      const item = estoqueItems[produto.id];
      if (!item) return false;
      // Precisa ter pelo menos 1 galão cheio OU ter um galão em uso
      return item.galoesCheios > 0 || item.galaoEmUso;
    });
  };

  const saveEstoque = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !produtos) return;

      // Validar antes de salvar
      if (!isEstoqueCompleto()) {
        throw new Error('Informe o estoque de todos os produtos antes de salvar.');
      }

      const updates = produtos.map((produto) => {
        const item = estoqueItems[produto.id];
        const galoesCheios = item?.galoesCheios || 0;
        const nivelParcial = item?.galaoEmUso ? (item.nivelGalaoParcial || 0) : null;
        
        // Calcular quantidade total em litros
        const quantidadeTotal = (galoesCheios * VOLUME_GALAO) + 
          (nivelParcial !== null ? (nivelParcial / 100) * VOLUME_GALAO : 0);

        return {
          cliente_id: selectedCliente,
          produto_id: produto.id,
          quantidade: quantidadeTotal,
          galoes_cheios: galoesCheios,
          nivel_galao_parcial: nivelParcial,
          atualizado_por: user?.id,
          data_atualizacao: new Date().toISOString(),
        };
      });

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

  // Atualizar estado quando estoque carregar
  useEffect(() => {
    if (estoque && produtos) {
      const newItems: Record<string, EstoqueItem> = {};
      produtos.forEach((produto) => {
        const estoqueItem = estoque.find((e) => e.produto_id === produto.id);
        newItems[produto.id] = {
          produtoId: produto.id,
          galoesCheios: estoqueItem?.galoes_cheios || 0,
          galaoEmUso: estoqueItem?.nivel_galao_parcial !== null && estoqueItem?.nivel_galao_parcial !== undefined,
          nivelGalaoParcial: estoqueItem?.nivel_galao_parcial || 0,
        };
      });
      setEstoqueItems(newItems);
    }
  }, [estoque, produtos]);

  const clienteSelecionado = clientes?.find((c) => c.id === selectedCliente);

  const getClienteLabel = (cliente: typeof clientes extends (infer T)[] ? T : never) => {
    return cliente.fazenda ? `${cliente.nome} - ${cliente.fazenda}` : cliente.nome;
  };

  const updateEstoqueItem = (produtoId: string, updates: Partial<EstoqueItem>) => {
    setEstoqueItems((prev) => ({
      ...prev,
      [produtoId]: { ...prev[produtoId], ...updates },
    }));
  };

  const calcularTotalLitros = (item: EstoqueItem | undefined) => {
    if (!item) return 0;
    const cheios = item.galoesCheios * VOLUME_GALAO;
    const parcial = item.galaoEmUso ? (item.nivelGalaoParcial / 100) * VOLUME_GALAO : 0;
    return cheios + parcial;
  };

  const niveisDisponiveis = [
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 0, label: 'Vazio' },
  ];

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
            <Button 
              onClick={() => saveEstoque.mutate()} 
              disabled={saveEstoque.isPending || !isEstoqueCompleto()}
            >
              {saveEstoque.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              produtos?.map((produto) => {
                const item = estoqueItems[produto.id];
                const totalLitros = calcularTotalLitros(item);
                
                return (
                  <div key={produto.id} className="rounded-lg border p-4 space-y-4">
                    {/* Header do produto */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Beaker className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{produto.nome}</p>
                        {produto.descricao && (
                          <p className="text-sm text-muted-foreground">{produto.descricao}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total estimado</p>
                        <p className="font-bold text-lg text-primary">{totalLitros}L</p>
                      </div>
                    </div>

                    {/* Galões Cheios */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                      <Label className="text-sm font-medium">Galões Cheios (50L)</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateEstoqueItem(produto.id, { 
                            galoesCheios: Math.max(0, (item?.galoesCheios || 0) - 1) 
                          })}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-bold text-lg">
                          {item?.galoesCheios || 0}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateEstoqueItem(produto.id, { 
                            galoesCheios: (item?.galoesCheios || 0) + 1 
                          })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Galão em Uso */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`galao-uso-${produto.id}`} className="text-sm font-medium">
                          Galão em Uso
                        </Label>
                        <Switch
                          id={`galao-uso-${produto.id}`}
                          checked={item?.galaoEmUso || false}
                          onCheckedChange={(checked) => 
                            updateEstoqueItem(produto.id, { 
                              galaoEmUso: checked,
                              nivelGalaoParcial: checked ? 50 : 0 
                            })
                          }
                        />
                      </div>

                      {/* Seletor de Nível com Barra Visual */}
                      {item?.galaoEmUso && (
                        <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                          <p className="text-sm text-muted-foreground">Nível do galão em uso:</p>
                          
                          {/* Botões de seleção */}
                          <div className="flex gap-2 flex-wrap">
                            {niveisDisponiveis.map((nivel) => (
                              <Button
                                key={nivel.value}
                                type="button"
                                variant={item.nivelGalaoParcial === nivel.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => updateEstoqueItem(produto.id, { nivelGalaoParcial: nivel.value })}
                                className="min-w-[60px]"
                              >
                                {nivel.label}
                              </Button>
                            ))}
                          </div>

                          {/* Barra visual de progresso */}
                          <div className="space-y-1">
                            <div className="h-6 w-full bg-muted rounded-full overflow-hidden border">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300 rounded-full",
                                  item.nivelGalaoParcial >= 75 ? "bg-primary" :
                                  item.nivelGalaoParcial >= 50 ? "bg-primary/80" :
                                  item.nivelGalaoParcial >= 25 ? "bg-primary/60" :
                                  "bg-muted-foreground/20"
                                )}
                                style={{ width: `${item.nivelGalaoParcial}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                              {item.nivelGalaoParcial > 0 
                                ? `${(item.nivelGalaoParcial / 100) * VOLUME_GALAO}L restantes`
                                : 'Galão vazio'
                              }
                            </p>
                          </div>
                        </div>
                      )}
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