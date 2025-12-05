import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Package, Pencil, Trash2, Beaker, Minus, ChevronsUpDown, Check, Calendar, Save, Loader2, ShieldAlert } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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
  galaoEmUso: boolean;
  nivelGalaoParcial: number;
}

const Envios = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const [dataEnvio, setDataEnvio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observacoes, setObservacoes] = useState("");
  const [envioItems, setEnvioItems] = useState<Record<string, EnvioItem>>({});

  // Check if user is admin
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

  // Initialize envioItems when produtos load
  useEffect(() => {
    if (produtos && produtos.length > 0 && Object.keys(envioItems).length === 0) {
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
        galaoEmUso: false,
        nivelGalaoParcial: 0,
      };
    });
    setEnvioItems(newItems);
  };

  const resetForm = () => {
    setSelectedCliente("");
    setDataEnvio(format(new Date(), "yyyy-MM-dd"));
    setObservacoes("");
    initializeEnvioItems();
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !produtos) return;

      // Get products with quantities > 0
      const produtosComEnvio = produtos.filter((produto) => {
        const item = envioItems[produto.id];
        return item && (item.galoesCheios > 0 || item.galaoEmUso);
      });

      if (produtosComEnvio.length === 0) {
        throw new Error("Informe pelo menos um produto para enviar.");
      }

      const inserts = produtosComEnvio.map((produto) => {
        const item = envioItems[produto.id];
        const galoesCheios = item?.galoesCheios || 0;
        const nivelParcial = item?.galaoEmUso ? (item.nivelGalaoParcial || 0) : 0;
        const quantidadeTotal =
          galoesCheios * VOLUME_GALAO +
          (nivelParcial > 0 ? (nivelParcial / 100) * VOLUME_GALAO : 0);

        return {
          cliente_id: selectedCliente,
          produto_id: produto.id,
          quantidade: quantidadeTotal,
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("envios_produtos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio excluído com sucesso!");
      setDeleteId(null);
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

  const calcularTotalLitros = (item: EnvioItem | undefined) => {
    if (!item) return 0;
    const cheios = item.galoesCheios * VOLUME_GALAO;
    const parcial = item.galaoEmUso ? (item.nivelGalaoParcial / 100) * VOLUME_GALAO : 0;
    return cheios + parcial;
  };

  const clienteSelecionado = clientes?.find((c) => c.id === selectedCliente);

  const getClienteLabel = (cliente: any) => {
    return cliente.fazenda ? `${cliente.nome} - ${cliente.fazenda}` : cliente.nome;
  };

  const niveisDisponiveis = [
    { value: 25, label: "25%" },
    { value: 50, label: "50%" },
    { value: 75, label: "75%" },
  ];

  const hasAnyEnvio = produtos.some((produto) => {
    const item = envioItems[produto.id];
    return item && (item.galoesCheios > 0 || item.galaoEmUso);
  });

  // If not admin, show access denied
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
              <DialogTitle>Registrar Novo Envio</DialogTitle>
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
                  const totalLitros = calcularTotalLitros(item);

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
                          Galões Cheios (50L)
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

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor={`galao-parcial-${produto.id}`}
                            className="text-sm font-medium"
                          >
                            Galão Parcial
                          </Label>
                          <Switch
                            id={`galao-parcial-${produto.id}`}
                            checked={item?.galaoEmUso || false}
                            onCheckedChange={(checked) =>
                              updateEnvioItem(produto.id, {
                                galaoEmUso: checked,
                                nivelGalaoParcial: checked ? 50 : 0,
                              })
                            }
                          />
                        </div>

                        {item?.galaoEmUso && (
                          <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                            <p className="text-sm text-muted-foreground">
                              Nível do galão:
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {niveisDisponiveis.map((nivel) => (
                                <Button
                                  key={nivel.value}
                                  type="button"
                                  variant={
                                    item.nivelGalaoParcial === nivel.value
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    updateEnvioItem(produto.id, {
                                      nivelGalaoParcial: nivel.value,
                                    })
                                  }
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
                                    item.nivelGalaoParcial >= 75
                                      ? "bg-primary"
                                      : item.nivelGalaoParcial >= 50
                                      ? "bg-primary/80"
                                      : "bg-primary/60"
                                  )}
                                  style={{ width: `${item.nivelGalaoParcial}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground text-center">
                                {(item.nivelGalaoParcial / 100) * VOLUME_GALAO}L
                              </p>
                            </div>
                          </div>
                        )}
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
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending || !selectedCliente || !hasAnyEnvio
                  }
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Registrar Envio
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : envios.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum envio registrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.map((envio: any) => (
                  <TableRow key={envio.id}>
                    <TableCell>
                      {format(new Date(envio.data_envio), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>{envio.cliente?.nome || "-"}</TableCell>
                    <TableCell>{envio.cliente?.fazenda || "-"}</TableCell>
                    <TableCell>{envio.produto?.nome || "-"}</TableCell>
                    <TableCell className="text-right">
                      {envio.quantidade} {envio.produto?.unidade || "L"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {envio.observacoes || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(envio.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
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
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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
