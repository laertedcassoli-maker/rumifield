import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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

interface EnvioForm {
  cliente_id: string;
  produto_id: string;
  quantidade: number;
  data_envio: string;
  observacoes: string;
}

const Envios = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEnvio, setEditingEnvio] = useState<any>(null);
  const [form, setForm] = useState<EnvioForm>({
    cliente_id: "",
    produto_id: "",
    quantidade: 0,
    data_envio: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

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
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: EnvioForm) => {
      const { error } = await supabase.from("envios_produtos").insert({
        cliente_id: data.cliente_id,
        produto_id: data.produto_id,
        quantidade: data.quantidade,
        data_envio: data.data_envio,
        observacoes: data.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio registrado com sucesso!");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao registrar envio: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EnvioForm }) => {
      const { error } = await supabase
        .from("envios_produtos")
        .update({
          cliente_id: data.cliente_id,
          produto_id: data.produto_id,
          quantidade: data.quantidade,
          data_envio: data.data_envio,
          observacoes: data.observacoes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio atualizado com sucesso!");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
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
    onError: (error) => {
      toast.error("Erro ao excluir envio: " + error.message);
    },
  });

  const resetForm = () => {
    setForm({
      cliente_id: "",
      produto_id: "",
      quantidade: 0,
      data_envio: format(new Date(), "yyyy-MM-dd"),
      observacoes: "",
    });
    setEditingEnvio(null);
  };

  const handleEdit = (envio: any) => {
    setEditingEnvio(envio);
    setForm({
      cliente_id: envio.cliente_id,
      produto_id: envio.produto_id,
      quantidade: envio.quantidade,
      data_envio: envio.data_envio,
      observacoes: envio.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.produto_id || form.quantidade <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (editingEnvio) {
      updateMutation.mutate({ id: editingEnvio.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Envios de Produtos</h1>
          <p className="text-muted-foreground">
            Registre os envios de produtos químicos para as fazendas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Envio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEnvio ? "Editar Envio" : "Registrar Novo Envio"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente/Fazenda *</Label>
                <Select
                  value={form.cliente_id}
                  onValueChange={(value) => setForm({ ...form, cliente_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome} {cliente.fazenda && `- ${cliente.fazenda}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="produto">Produto *</Label>
                <Select
                  value={form.produto_id}
                  onValueChange={(value) => setForm({ ...form, produto_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade (litros) *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_envio">Data do Envio *</Label>
                <Input
                  id="data_envio"
                  type="date"
                  value={form.data_envio}
                  onChange={(e) => setForm({ ...form, data_envio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingEnvio ? "Salvar" : "Registrar"}
                </Button>
              </div>
            </form>
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
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.map((envio: any) => (
                  <TableRow key={envio.id}>
                    <TableCell>
                      {format(new Date(envio.data_envio), "dd/MM/yyyy", { locale: ptBR })}
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
              Tem certeza que deseja excluir este envio? Esta ação não pode ser desfeita.
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
