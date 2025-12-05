import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Beaker, Loader2, Save, ChevronsUpDown, Check, Minus, Plus, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const VOLUME_GALAO = 50;

interface EstoqueItem {
  produtoId: string;
  galoesCheios: number;
  galaoEmUso: boolean;
  nivelGalaoParcial: number;
}

interface NovaAfericaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaAfericaoDialog({ open, onOpenChange, onSuccess }: NovaAfericaoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [estoqueItems, setEstoqueItems] = useState<Record<string, EstoqueItem>>({});
  const [clienteOpen, setClienteOpen] = useState(false);
  const [dataAfericao, setDataAfericao] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [responsavel, setResponsavel] = useState<'Cliente' | 'CSM'>('Cliente');

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

  // Inicializar estoqueItems quando produtos carregarem
  useEffect(() => {
    if (produtos && Object.keys(estoqueItems).length === 0) {
      const newItems: Record<string, EstoqueItem> = {};
      produtos.forEach((produto) => {
        newItems[produto.id] = {
          produtoId: produto.id,
          galoesCheios: 0,
          galaoEmUso: false,
          nivelGalaoParcial: 0,
        };
      });
      setEstoqueItems(newItems);
    }
  }, [produtos, estoqueItems]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedCliente('');
      setDataAfericao(format(new Date(), 'yyyy-MM-dd'));
      setResponsavel('Cliente');
      if (produtos) {
        const newItems: Record<string, EstoqueItem> = {};
        produtos.forEach((produto) => {
          newItems[produto.id] = {
            produtoId: produto.id,
            galoesCheios: 0,
            galaoEmUso: false,
            nivelGalaoParcial: 0,
          };
        });
        setEstoqueItems(newItems);
      }
    }
  }, [open, produtos]);

  const isEstoqueCompleto = () => {
    if (!produtos) return false;
    return produtos.every((produto) => {
      const item = estoqueItems[produto.id];
      if (!item) return false;
      return item.galoesCheios > 0 || item.galaoEmUso;
    });
  };

  const saveEstoque = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !produtos) return;

      if (!isEstoqueCompleto()) {
        throw new Error('Informe o estoque de todos os produtos antes de salvar.');
      }

      const inserts = produtos.map((produto) => {
        const item = estoqueItems[produto.id];
        const galoesCheios = item?.galoesCheios || 0;
        const nivelParcial = item?.galaoEmUso ? (item.nivelGalaoParcial || 0) : null;
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
          data_afericao: dataAfericao,
          responsavel: responsavel,
        };
      });

      const { error } = await supabase.from('estoque_cliente').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Aferição registrada com sucesso!' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    },
  });

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Aferição de Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seleção de Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
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
          </div>

          {/* Data e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-afericao" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data da Aferição
              </Label>
              <Input
                id="data-afericao"
                type="date"
                value={dataAfericao}
                onChange={(e) => setDataAfericao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável</Label>
              <Select value={responsavel} onValueChange={(v) => setResponsavel(v as 'Cliente' | 'CSM')}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cliente">Cliente</SelectItem>
                  <SelectItem value="CSM">CSM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Produtos */}
          {selectedCliente && produtos?.map((produto) => {
            const item = estoqueItems[produto.id];
            const totalLitros = calcularTotalLitros(item);
            
            return (
              <div key={produto.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Beaker className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{produto.nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total estimado</p>
                    <p className="font-bold text-lg text-primary">{totalLitros}L</p>
                  </div>
                </div>

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

                  {item?.galaoEmUso && (
                    <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                      <p className="text-sm text-muted-foreground">Nível do galão em uso:</p>
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
          })}

          {/* Botão Salvar */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={() => saveEstoque.mutate()} 
              disabled={saveEstoque.isPending || !selectedCliente || !isEstoqueCompleto()}
            >
              {saveEstoque.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Aferição
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
