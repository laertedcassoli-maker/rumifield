import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Settings, Copy, Trash2, Search, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function TreinamentoTemplates() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [search, setSearch] = useState("");

  const canManage = role === 'admin' || role === 'coordenador_servicos';

  const { data: templates, isLoading } = useQuery({
    queryKey: ['training-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_templates')
        .select(`
          *,
          blocks:training_template_blocks(
            id,
            block_name,
            order_index,
            items:training_template_items(id)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('training_templates')
        .insert({ name: newTemplateName, description: newTemplateDescription || null })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-templates'] });
      toast.success('Template criado com sucesso!');
      setIsCreateOpen(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      navigate(`/treinamento/templates/${data.id}`);
    },
    onError: (error) => {
      toast.error('Erro ao criar template: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('training_templates')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-templates'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: original, error: originalError } = await supabase
        .from('training_templates')
        .select('name, description, active')
        .eq('id', templateId)
        .single();
      if (originalError) throw originalError;

      const { data: newTemplate, error: insertError } = await supabase
        .from('training_templates')
        .insert({
          name: `${original.name} (Cópia)`,
          description: original.description,
          active: original.active,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      const { data: blocks, error: blocksError } = await supabase
        .from('training_template_blocks')
        .select('id, block_name, order_index')
        .eq('template_id', templateId)
        .order('order_index');
      if (blocksError) throw blocksError;

      for (const block of blocks || []) {
        const { data: newBlock, error: newBlockError } = await supabase
          .from('training_template_blocks')
          .insert({
            template_id: newTemplate.id,
            block_name: block.block_name,
            order_index: block.order_index,
          })
          .select('id')
          .single();
        if (newBlockError) throw newBlockError;

        const { data: items, error: itemsError } = await supabase
          .from('training_template_items')
          .select('item_name, order_index, active')
          .eq('block_id', block.id)
          .order('order_index');
        if (itemsError) throw itemsError;

        if (items && items.length > 0) {
          const { error: newItemsError } = await supabase
            .from('training_template_items')
            .insert(items.map(item => ({ ...item, block_id: newBlock.id })));
          if (newItemsError) throw newItemsError;
        }
      }

      return newTemplate.id as string;
    },
    onSuccess: (newTemplateId) => {
      queryClient.invalidateQueries({ queryKey: ['training-templates'] });
      toast.success('Template duplicado com sucesso!');
      navigate(`/treinamento/templates/${newTemplateId}`);
    },
    onError: (error) => {
      toast.error('Erro ao duplicar: ' + error.message);
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('training_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-templates'] });
      toast.success('Template excluído com sucesso!');
    },
    onError: (error: any) => {
      if (error?.code === '23503') {
        toast.error('Este treinamento já foi usado em uma ou mais execuções e não pode ser excluído. Use o botão Ativo/Inativo para desativá-lo.');
      } else {
        toast.error('Erro ao excluir: ' + error.message);
      }
    }
  });

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const termo = search.trim().toLowerCase();
  const filtered = (templates || []).filter(t =>
    !termo ||
    t.name.toLowerCase().includes(termo) ||
    (t.description || '').toLowerCase().includes(termo)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Templates de Treinamento</h1>
          <p className="text-muted-foreground">
            Configure os roteiros de treinamento aplicados aos clientes
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Template *</Label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Ex: Treinamento RumiFlow - v1"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="Descrição opcional do template"
                />
              </div>
              <Button
                onClick={() => createTemplateMutation.mutate()}
                disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                className="w-full"
              >
                Criar Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro template de treinamento para começar.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(template => {
            const totalItems = template.blocks?.reduce(
              (acc: number, block: any) => acc + (block.items?.length || 0),
              0
            ) || 0;

            return (
              <Card
                key={template.id}
                className={`group hover:shadow-md transition-shadow ${!template.active ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.description && (
                        <CardDescription className="line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={template.active ? "default" : "secondary"}>
                      {template.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground mb-4">
                    {template.blocks?.length || 0} blocos • {totalItems} itens
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/treinamento/templates/${template.id}`)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateTemplateMutation.mutate(template.id)}
                      disabled={duplicateTemplateMutation.isPending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir "{template.name}"?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">Ativo</span>
                    <Switch
                      checked={template.active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: template.id, active: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
