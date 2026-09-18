import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Save, Pencil } from "lucide-react";

interface TrainingItem {
  id: string;
  item_name: string;
  order_index: number;
  active: boolean;
}

interface TrainingBlock {
  id: string;
  block_name: string;
  order_index: number;
  items: TrainingItem[];
}

export default function TreinamentoTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [addItemBlockId, setAddItemBlockId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");

  const canManage = role === 'admin' || role === 'coordenador_servicos';

  const { data: template, isLoading } = useQuery({
    queryKey: ['training-template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_templates')
        .select(`
          *,
          blocks:training_template_blocks(
            id,
            block_name,
            order_index,
            items:training_template_items(
              id,
              item_name,
              order_index,
              active
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const blocks: TrainingBlock[] = (data.blocks || [])
        .map((b: any) => ({
          ...b,
          items: (b.items || []).sort((x: TrainingItem, y: TrainingItem) => x.order_index - y.order_index),
        }))
        .sort((a: TrainingBlock, b: TrainingBlock) => a.order_index - b.order_index);

      return { ...data, blocks };
    },
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['training-template', id] });

  const updateTemplateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('training_templates')
        .update({ name: templateName, description: templateDescription || null })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['training-templates'] });
      setEditingTemplate(false);
      toast.success('Template atualizado!');
    },
    onError: (error) => toast.error('Erro ao atualizar: ' + error.message),
  });

  const addBlockMutation = useMutation({
    mutationFn: async () => {
      const nextIndex = template?.blocks?.length || 0;
      const { error } = await supabase
        .from('training_template_blocks')
        .insert({ template_id: id!, block_name: newBlockName, order_index: nextIndex });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setIsAddBlockOpen(false);
      setNewBlockName("");
      toast.success('Bloco adicionado!');
    },
    onError: (error) => toast.error('Erro ao adicionar bloco: ' + error.message),
  });

  const updateBlockMutation = useMutation({
    mutationFn: async ({ blockId, blockName }: { blockId: string; blockName: string }) => {
      const { error } = await supabase
        .from('training_template_blocks')
        .update({ block_name: blockName })
        .eq('id', blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingBlockId(null);
      toast.success('Bloco atualizado!');
    },
    onError: (error) => toast.error('Erro ao atualizar bloco: ' + error.message),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from('training_template_blocks').delete().eq('id', blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Bloco excluído!');
    },
    onError: (error: any) => {
      if (error?.code === '23503') {
        toast.error('Este bloco já foi usado em uma execução e não pode ser excluído.');
      } else {
        toast.error('Erro ao excluir bloco: ' + error.message);
      }
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const block = template?.blocks?.find((b: TrainingBlock) => b.id === addItemBlockId);
      const nextIndex = block?.items?.length || 0;
      const { error } = await supabase
        .from('training_template_items')
        .insert({ block_id: addItemBlockId!, item_name: newItemName, order_index: nextIndex });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setIsAddItemOpen(false);
      setNewItemName("");
      setAddItemBlockId(null);
      toast.success('Item adicionado!');
    },
    onError: (error) => toast.error('Erro ao adicionar item: ' + error.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, itemName, active }: { itemId: string; itemName?: string; active?: boolean }) => {
      const payload: Record<string, unknown> = {};
      if (itemName !== undefined) payload.item_name = itemName;
      if (active !== undefined) payload.active = active;
      const { error } = await supabase.from('training_template_items').update(payload).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingItemId(null);
    },
    onError: (error) => toast.error('Erro ao atualizar item: ' + error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('training_template_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Item excluído!');
    },
    onError: (error: any) => {
      if (error?.code === '23503') {
        toast.error('Este item já foi usado em uma execução e não pode ser excluído. Desative-o em vez de excluir.');
      } else {
        toast.error('Erro ao excluir item: ' + error.message);
      }
    },
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: async (ordered: TrainingBlock[]) => {
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase
          .from('training_template_blocks')
          .update({ order_index: i })
          .eq('id', ordered[i].id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (error) => toast.error('Erro ao reordenar: ' + error.message),
  });

  const reorderItemsMutation = useMutation({
    mutationFn: async (ordered: TrainingItem[]) => {
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase
          .from('training_template_items')
          .update({ order_index: i })
          .eq('id', ordered[i].id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (error) => toast.error('Erro ao reordenar: ' + error.message),
  });

  const moveBlock = (index: number, direction: -1 | 1) => {
    const blocks = [...(template?.blocks || [])] as TrainingBlock[];
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    reorderBlocksMutation.mutate(blocks);
  };

  const moveItem = (block: TrainingBlock, index: number, direction: -1 | 1) => {
    const items = [...block.items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    reorderItemsMutation.mutate(items);
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.has(blockId) ? next.delete(blockId) : next.add(blockId);
      return next;
    });
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !template) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  const blocks = (template.blocks || []) as TrainingBlock[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/treinamento/templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold truncate">{template.name}</h1>
          {template.description && (
            <p className="text-muted-foreground truncate">{template.description}</p>
          )}
        </div>
        <Badge variant={template.active ? 'default' : 'secondary'}>
          {template.active ? 'Ativo' : 'Inativo'}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTemplateName(template.name);
            setTemplateDescription(template.description || '');
            setEditingTemplate(true);
          }}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Editar dados
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Blocos e itens</h2>
        <Button onClick={() => setIsAddBlockOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Bloco
        </Button>
      </div>

      {blocks.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhum bloco criado ainda. Comece adicionando um bloco.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, blockIndex) => {
            const isOpen = expandedBlocks.has(block.id);
            return (
              <Card key={block.id}>
                <Collapsible open={isOpen} onOpenChange={() => toggleBlock(block.id)}>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={blockIndex === 0 || reorderBlocksMutation.isPending}
                          onClick={() => moveBlock(blockIndex, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={blockIndex === blocks.length - 1 || reorderBlocksMutation.isPending}
                          onClick={() => moveBlock(blockIndex, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>

                      {editingBlockId === block.id ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Input
                            value={editingBlockName}
                            onChange={(e) => setEditingBlockName(e.target.value)}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            onClick={() => updateBlockMutation.mutate({ blockId: block.id, blockName: editingBlockName })}
                            disabled={!editingBlockName.trim() || updateBlockMutation.isPending}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingBlockId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <CardTitle className="text-base flex-1 min-w-0 truncate">
                          {block.block_name}
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            {block.items.length} itens
                          </span>
                        </CardTitle>
                      )}

                      {editingBlockId !== block.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingBlockId(block.id);
                              setEditingBlockName(block.block_name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Bloco</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Excluir "{block.block_name}" também remove todos os seus itens. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteBlockMutation.mutate(block.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="space-y-2 pt-0">
                      {block.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum item neste bloco.</p>
                      ) : (
                        block.items.map((item, itemIndex) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 p-2 border rounded-lg ${!item.active ? 'opacity-60' : ''}`}
                          >
                            <div className="flex flex-col">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={itemIndex === 0 || reorderItemsMutation.isPending}
                                onClick={() => moveItem(block, itemIndex, -1)}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={itemIndex === block.items.length - 1 || reorderItemsMutation.isPending}
                                onClick={() => moveItem(block, itemIndex, 1)}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>

                            {editingItemId === item.id ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Input
                                  value={editingItemName}
                                  onChange={(e) => setEditingItemName(e.target.value)}
                                  className="h-8"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => updateItemMutation.mutate({ itemId: item.id, itemName: editingItemName })}
                                  disabled={!editingItemName.trim() || updateItemMutation.isPending}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingItemId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <span className="flex-1 min-w-0 truncate text-sm">{item.item_name}</span>
                            )}

                            {editingItemId !== item.id && (
                              <>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground">Ativo</Label>
                                  <Switch
                                    checked={item.active}
                                    onCheckedChange={(checked) =>
                                      updateItemMutation.mutate({ itemId: item.id, active: checked })
                                    }
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditingItemName(item.item_name);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Item</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir "{item.item_name}"?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteItemMutation.mutate(item.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        ))
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddItemBlockId(block.id);
                          setNewItemName("");
                          setIsAddItemOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Item
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={editingTemplate} onOpenChange={setEditingTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => updateTemplateMutation.mutate()}
              disabled={!templateName.trim() || updateTemplateMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddBlockOpen} onOpenChange={setIsAddBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Bloco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Bloco *</Label>
              <Input
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="Ex: Apresentação do equipamento"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => addBlockMutation.mutate()}
              disabled={!newBlockName.trim() || addBlockMutation.isPending}
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Item *</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Ex: Explicar rotina de limpeza"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => addItemMutation.mutate()}
              disabled={!newItemName.trim() || addItemMutation.isPending}
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
