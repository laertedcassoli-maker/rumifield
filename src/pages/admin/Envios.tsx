import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Package, Pencil, Trash2, Beaker, Minus, ChevronsUpDown, Check, Calendar, Save, Loader2, ShieldAlert, Filter, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const VOLUME_GALAO = 50;

interface EnvioItem {
  produtoId: string;
  galoesCheios: number;
}

interface EnvioAgrupado {
  chave: string;
  data_envio: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_fazenda: string | null;
  observacoes: string | null;
  produtos: Record<string, { id: string; quantidade: number; galoes: number }>;
  envioIds: string[];
}

interface Filters {
  cliente: string;
  fazenda: string;
  dataInicio: string;
  dataFim: string;
}

type SortColumn = 'data' | 'cliente' | 'fazenda' | string;
type SortDirection = 'asc' | 'desc' | null;

const Envios = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [editingGroup, setEditingGroup] = useState<EnvioAgrupado | null>(null);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const [dataEnvio, setDataEnvio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observacoes, setObservacoes] = useState("");
  const [envioItems, setEnvioItems] = useState<Record<string, EnvioItem>>({});
  
  // Filter and sort states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    cliente: "",
    fazenda: "",
    dataInicio: "",
    dataFim: "",
  });
  const [sortColumn, setSortColumn] = useState<SortColumn>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const isAdmin = role === "admin";

  // Fetch clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, fazenda")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch produtos
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_quimicos")
        .select("id, nome, unidade")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch envios
  const { data: envios = [], isLoading } = useQuery({
    queryKey: ["envios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("envios_produtos")
        .select(`
          *,
          cliente:clientes(nome, fazenda),
          produto:produtos_quimicos(nome, unidade)
        `)
        .order("data_envio", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Group envios by date + client, then filter and sort
  const enviosAgrupados = useMemo(() => {
    const grupos: Record<string, EnvioAgrupado> = {};
    
    envios.forEach((envio: any) => {
      const chave = `${envio.data_envio}_${envio.cliente_id}`;
      
      if (!grupos[chave]) {
        grupos[chave] = {
          chave,
          data_envio: envio.data_envio,
          cliente_id: envio.cliente_id,
          cliente_nome: envio.cliente?.nome || "-",
          cliente_fazenda: envio.cliente?.fazenda || null,
          observacoes: envio.observacoes,
          produtos: {},
          envioIds: [],
        };
      }
      
      grupos[chave].produtos[envio.produto_id] = {
        id: envio.id,
        quantidade: envio.quantidade,
        galoes: envio.galoes || Math.round(envio.quantidade / VOLUME_GALAO),
      };
      grupos[chave].envioIds.push(envio.id);
    });
    
    let lista = Object.values(grupos);
    
    // Apply filters
    if (filters.cliente) {
      lista = lista.filter(g => 
        g.cliente_nome.toLowerCase().includes(filters.cliente.toLowerCase())
      );
    }
    if (filters.fazenda) {
      lista = lista.filter(g => 
        g.cliente_fazenda?.toLowerCase().includes(filters.fazenda.toLowerCase())
      );
    }
    if (filters.dataInicio) {
      lista = lista.filter(g => g.data_envio >= filters.dataInicio);
    }
    if (filters.dataFim) {
      lista = lista.filter(g => g.data_envio <= filters.dataFim);
    }
    
    // Apply sorting
    if (sortColumn && sortDirection) {
      lista.sort((a, b) => {
        let comparison = 0;
        
        if (sortColumn === 'data') {
          comparison = new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime();
        } else if (sortColumn === 'cliente') {
          comparison = a.cliente_nome.localeCompare(b.cliente_nome);
        } else if (sortColumn === 'fazenda') {
          comparison = (a.cliente_fazenda || '').localeCompare(b.cliente_fazenda || '');
        } else {
          // Sort by product column (by quantidade)
          const qtyA = a.produtos[sortColumn]?.quantidade || 0;
          const qtyB = b.produtos[sortColumn]?.quantidade || 0;
          comparison = qtyA - qtyB;
        }
        
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    return lista;
  }, [envios, filters, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortColumn('data');
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4 ml-1" />;
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const clearFilters = () => {
    setFilters({ cliente: "", fazenda: "", dataInicio: "", dataFim: "" });
  };

  useEffect(() => {
    if (produtos && produtos.length > 0 && Object.keys(envioItems).length === 0 && !editingGroup) {
      initializeEnvioItems();
    }
  }, [produtos]);

  const initializeEnvioItems = () => {
    if (!produtos) return;
    const newItems: Record<string, EnvioItem> = {};
    produtos.forEach((produto) => {
      newItems[produto.id] = {
        produtoId: produto.id,
        galoesCheios: 0,
      };
    });
    setEnvioItems(newItems);
  };

  const resetForm = () => {
    setSelectedCliente("");
    setDataEnvio(format(new Date(), "yyyy-MM-dd"));
    setObservacoes("");
    setEditingGroup(null);
    initializeEnvioItems();
  };

  const handleEdit = (grupo: EnvioAgrupado) => {
    setEditingGroup(grupo);
    setSelectedCliente(grupo.cliente_id);
    setDataEnvio(grupo.data_envio);
    setObservacoes(grupo.observacoes || "");
    
    const newItems: Record<string, EnvioItem> = {};
    produtos.forEach((produto) => {
      const produtoEnvio = grupo.produtos[produto.id];
      newItems[produto.id] = {
        produtoId: produto.id,
        galoesCheios: produtoEnvio ? produtoEnvio.galoes : 0,
      };
    });
    setEnvioItems(newItems);
    setDialogOpen(true);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !produtos) return;

      const produtosComEnvio = produtos.filter((produto) => {
        const item = envioItems[produto.id];
        return item && item.galoesCheios > 0;
      });

      if (produtosComEnvio.length === 0) {
        throw new Error("Informe pelo menos um produto para enviar.");
      }

      const inserts = produtosComEnvio.map((produto) => {
        const item = envioItems[produto.id];
        const galoes = item?.galoesCheios || 0;
        const quantidadeTotal = galoes * VOLUME_GALAO;

        return {
          cliente_id: selectedCliente,
          produto_id: produto.id,
          quantidade: quantidadeTotal,
          galoes: galoes,
          data_envio: dataEnvio,
          observacoes: observacoes || null,
          registrado_por: user?.id,
        };
      });

      const { error } = await supabase.from("envios_produtos").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio registrado com sucesso!");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Erro ao registrar envio: " + error.message);
    },
  });

  // Update mutation with logging
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingGroup || !selectedCliente) return;

      // Delete existing envios for this group
      const { error: deleteError } = await supabase
        .from("envios_produtos")
        .delete()
        .in("id", editingGroup.envioIds);

      if (deleteError) throw deleteError;

      // Insert new envios
      const produtosComEnvio = produtos.filter((produto) => {
        const item = envioItems[produto.id];
        return item && item.galoesCheios > 0;
      });

      if (produtosComEnvio.length === 0) {
        throw new Error("Informe pelo menos um produto.");
      }

      const inserts = produtosComEnvio.map((produto) => {
        const item = envioItems[produto.id];
        const galoes = item?.galoesCheios || 0;
        const quantidadeTotal = galoes * VOLUME_GALAO;

        return {
          cliente_id: selectedCliente,
          produto_id: produto.id,
          quantidade: quantidadeTotal,
          galoes: galoes,
          data_envio: dataEnvio,
          observacoes: observacoes || null,
          registrado_por: user?.id,
        };
      });

      const { error: insertError } = await supabase.from("envios_produtos").insert(inserts);
      if (insertError) throw insertError;

      // Log the edit
      const clienteNovo = clientes.find(c => c.id === selectedCliente);
      const { error: logError } = await supabase.from("envios_log").insert({
        envio_id: editingGroup.envioIds[0],
        usuario_id: user?.id,
        campo_alterado: "envio_atualizado",
        valor_anterior: `${editingGroup.cliente_nome} - ${editingGroup.data_envio}`,
        valor_novo: `${clienteNovo?.nome || selectedCliente} - ${dataEnvio}`,
      });
      if (logError) console.error("Erro ao registrar log:", logError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio atualizado com sucesso!");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar envio: " + error.message);
    },
  });

  // Delete mutation (deletes all envios in a group)
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("envios_produtos")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio excluído com sucesso!");
      setDeleteIds(null);
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir envio: " + error.message);
    },
  });

  const updateEnvioItem = (produtoId: string, updates: Partial<EnvioItem>) => {
    setEnvioItems((prev) => ({
      ...prev,
      [produtoId]: { ...prev[produtoId], ...updates },
    }));
  };

  const clienteSelecionado = clientes?.find((c) => c.id === selectedCliente);

  const getClienteLabel = (cliente: any) => {
    return cliente.fazenda ? `${cliente.nome} - ${cliente.fazenda}` : cliente.nome;
  };

  const hasAnyEnvio = produtos.some((produto) => {
    const item = envioItems[produto.id];
    return item && item.galoesCheios > 0;
  });

  const handleSubmit = () => {
    if (editingGroup) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Acesso Restrito</h1>
        <p className="text-muted-foreground">
          Esta página é acessível apenas para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Envios de Produtos</h1>
          <p className="text-muted-foreground">
            Registre os envios de produtos químicos para as fazendas
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Envio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? "Editar Envio" : "Registrar Novo Envio"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Seleção de Cliente */}
              <div className="space-y-2">
                <Label>Cliente / Fazenda</Label>
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
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
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
                                  selectedCliente === cliente.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{cliente.nome}</span>
                                {cliente.fazenda && (
                                  <span className="text-xs text-muted-foreground">
                                    {cliente.fazenda}
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
              </div>

              {/* Data do Envio */}
              <div className="space-y-2">
                <Label htmlFor="data-envio" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data do Envio
                </Label>
                <Input
                  id="data-envio"
                  type="date"
                  value={dataEnvio}
                  onChange={(e) => setDataEnvio(e.target.value)}
                />
              </div>

              {/* Produtos */}
              {selectedCliente &&
                produtos?.map((produto) => {
                  const item = envioItems[produto.id];
                  const totalLitros = (item?.galoesCheios || 0) * VOLUME_GALAO;

                  return (
                    <div
                      key={produto.id}
                      className="rounded-lg border p-4 space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Beaker className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{produto.nome}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Total a enviar
                          </p>
                          <p className="font-bold text-lg text-primary">
                            {totalLitros}L
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <Label className="text-sm font-medium">
                          Galões (50L cada)
                        </Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateEnvioItem(produto.id, {
                                galoesCheios: Math.max(
                                  0,
                                  (item?.galoesCheios || 0) - 1
                                ),
                              })
                            }
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
                            onClick={() =>
                              updateEnvioItem(produto.id, {
                                galoesCheios: (item?.galoesCheios || 0) + 1,
                              })
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Observações */}
              {selectedCliente && (
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais..."
                  />
                </div>
              )}

              {/* Botão Salvar */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    createMutation.isPending || updateMutation.isPending || !selectedCliente || !hasAnyEnvio
                  }
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {editingGroup ? "Salvar Alterações" : "Registrar Envio"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter section */}
          {showFilters && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={filters.cliente}
                    onChange={(e) => setFilters({ ...filters, cliente: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fazenda</Label>
                  <Input
                    placeholder="Filtrar por fazenda..."
                    value={filters.fazenda}
                    onChange={(e) => setFilters({ ...filters, fazenda: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filters.dataInicio}
                    onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.dataFim}
                    onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar filtros
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : enviosAgrupados.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum envio registrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('data')}
                    >
                      <div className="flex items-center">
                        Data
                        {getSortIcon('data')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('cliente')}
                    >
                      <div className="flex items-center">
                        Cliente
                        {getSortIcon('cliente')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('fazenda')}
                    >
                      <div className="flex items-center">
                        Fazenda
                        {getSortIcon('fazenda')}
                      </div>
                    </TableHead>
                    {produtos.map((produto) => (
                      <TableHead 
                        key={produto.id} 
                        className="text-center cursor-pointer select-none"
                        onClick={() => handleSort(produto.id)}
                      >
                        <div className="flex items-center justify-center">
                          {produto.nome}
                          {getSortIcon(produto.id)}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead>Obs.</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enviosAgrupados.map((grupo) => (
                    <TableRow key={grupo.chave}>
                      <TableCell>
                        {format(new Date(grupo.data_envio), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{grupo.cliente_nome}</TableCell>
                      <TableCell>{grupo.cliente_fazenda || "-"}</TableCell>
                      {produtos.map((produto) => {
                        const produtoEnvio = grupo.produtos[produto.id];
                        return (
                          <TableCell key={produto.id} className="text-center">
                            {produtoEnvio ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-primary">
                                  {produtoEnvio.quantidade}L
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({produtoEnvio.galoes} galões de 50L)
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="max-w-[150px] truncate">
                        {grupo.observacoes || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(grupo)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteIds(grupo.envioIds)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteIds} onOpenChange={() => setDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este envio? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteIds && deleteMutation.mutate(deleteIds)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Envios;
