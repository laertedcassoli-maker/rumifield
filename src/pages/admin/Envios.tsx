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

const Envios = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEnvio, setEditingEnvio] = useState<any>(null);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const [dataEnvio, setDataEnvio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observacoes, setObservacoes] = useState("");
  const [envioItems, setEnvioItems] = useState<Record<string, EnvioItem>>({});

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

  useEffect(() => {
    if (produtos && produtos.length > 0 && Object.keys(envioItems).length === 0 && !editingEnvio) {
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
    setEditingEnvio(null);
    initializeEnvioItems();
  };

  const handleEdit = (envio: any) => {
    setEditingEnvio(envio);
    setSelectedCliente(envio.cliente_id);
    setDataEnvio(envio.data_envio);
    setObservacoes(envio.observacoes || "");
    
    // Set the specific product's galões
    const newItems: Record<string, EnvioItem> = {};
    produtos.forEach((produto) => {
      newItems[produto.id] = {
        produtoId: produto.id,
        galoesCheios: produto.id === envio.produto_id ? Math.round(envio.quantidade / VOLUME_GALAO) : 0,
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
        const quantidadeTotal = (item?.galoesCheios || 0) * VOLUME_GALAO;

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

  // Update mutation with logging
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingEnvio || !selectedCliente) return;

      // Find the product with galões > 0
      const produtoEnviado = produtos.find((produto) => {
        const item = envioItems[produto.id];
        return item && item.galoesCheios > 0;
      });

      if (!produtoEnviado) {
        throw new Error("Informe pelo menos um produto.");
      }

      const item = envioItems[produtoEnviado.id];
      const novaQuantidade = (item?.galoesCheios || 0) * VOLUME_GALAO;

      // Prepare log entries for changes
      const logs: Array<{
        envio_id: string;
        usuario_id: string | undefined;
        campo_alterado: string;
        valor_anterior: string;
        valor_novo: string;
      }> = [];

      if (editingEnvio.cliente_id !== selectedCliente) {
        const clienteAnterior = clientes.find(c => c.id === editingEnvio.cliente_id);
        const clienteNovo = clientes.find(c => c.id === selectedCliente);
        logs.push({
          envio_id: editingEnvio.id,
          usuario_id: user?.id,
          campo_alterado: "cliente",
          valor_anterior: clienteAnterior ? `${clienteAnterior.nome}${clienteAnterior.fazenda ? ` - ${clienteAnterior.fazenda}` : ''}` : editingEnvio.cliente_id,
          valor_novo: clienteNovo ? `${clienteNovo.nome}${clienteNovo.fazenda ? ` - ${clienteNovo.fazenda}` : ''}` : selectedCliente,
        });
      }

      if (editingEnvio.produto_id !== produtoEnviado.id) {
        const produtoAnterior = produtos.find(p => p.id === editingEnvio.produto_id);
        logs.push({
          envio_id: editingEnvio.id,
          usuario_id: user?.id,
          campo_alterado: "produto",
          valor_anterior: produtoAnterior?.nome || editingEnvio.produto_id,
          valor_novo: produtoEnviado.nome,
        });
      }

      if (editingEnvio.quantidade !== novaQuantidade) {
        logs.push({
          envio_id: editingEnvio.id,
          usuario_id: user?.id,
          campo_alterado: "quantidade",
          valor_anterior: `${editingEnvio.quantidade}L (${Math.round(editingEnvio.quantidade / VOLUME_GALAO)} galões)`,
          valor_novo: `${novaQuantidade}L (${item?.galoesCheios || 0} galões)`,
        });
      }

      if (editingEnvio.data_envio !== dataEnvio) {
        logs.push({
          envio_id: editingEnvio.id,
          usuario_id: user?.id,
          campo_alterado: "data_envio",
          valor_anterior: format(new Date(editingEnvio.data_envio), "dd/MM/yyyy"),
          valor_novo: format(new Date(dataEnvio), "dd/MM/yyyy"),
        });
      }

      if ((editingEnvio.observacoes || "") !== (observacoes || "")) {
        logs.push({
          envio_id: editingEnvio.id,
          usuario_id: user?.id,
          campo_alterado: "observacoes",
          valor_anterior: editingEnvio.observacoes || "(vazio)",
          valor_novo: observacoes || "(vazio)",
        });
      }

      // Update the envio
      const { error: updateError } = await supabase
        .from("envios_produtos")
        .update({
          cliente_id: selectedCliente,
          produto_id: produtoEnviado.id,
          quantidade: novaQuantidade,
          data_envio: dataEnvio,
          observacoes: observacoes || null,
        })
        .eq("id", editingEnvio.id);

      if (updateError) throw updateError;

      // Insert logs if there are changes
      if (logs.length > 0) {
        const { error: logError } = await supabase
          .from("envios_log")
          .insert(logs);
        if (logError) console.error("Erro ao registrar log:", logError);
      }
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

  const clienteSelecionado = clientes?.find((c) => c.id === selectedCliente);

  const getClienteLabel = (cliente: any) => {
    return cliente.fazenda ? `${cliente.nome} - ${cliente.fazenda}` : cliente.nome;
  };

  const hasAnyEnvio = produtos.some((produto) => {
    const item = envioItems[produto.id];
    return item && item.galoesCheios > 0;
  });

  const handleSubmit = () => {
    if (editingEnvio) {
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
                {editingEnvio ? "Editar Envio" : "Registrar Novo Envio"}
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

              {/* Produtos - Apenas galões cheios */}
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
                  {editingEnvio ? "Salvar Alterações" : "Registrar Envio"}
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
                  <TableHead className="text-right">Qtd (Galões)</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
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
                      {envio.quantidade}L ({Math.round(envio.quantidade / VOLUME_GALAO)} gal.)
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {envio.observacoes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(envio)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(envio.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
