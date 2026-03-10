import { useState, useCallback } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Save, Wrench, Copy, AlertTriangle } from "lucide-react";
import NonconformityPartsManager from "@/components/preventivas/NonconformityPartsManager";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

interface CorrectiveAction {
  id: string;
  action_label: string;
  order_index: number;
  active: boolean;
}

interface Nonconformity {
  id: string;
  nonconformity_label: string;
  order_index: number;
  active: boolean;
}

interface ChecklistItem {
  id: string;
  item_name: string;
  order_index: number;
  active: boolean;
  actions: CorrectiveAction[];
  nonconformities: Nonconformity[];
}

interface ChecklistBlock {
  id: string;
  block_name: string;
  order_index: number;
  items: ChecklistItem[];
}

export default function ChecklistEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  // New block dialog
  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");

  // New item dialog
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [addItemBlockId, setAddItemBlockId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");

  // New action dialog
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [addActionItemId, setAddActionItemId] = useState<string | null>(null);
  const [newActionLabel, setNewActionLabel] = useState("");

  // New nonconformity dialog
  const [isAddNonconformityOpen, setIsAddNonconformityOpen] = useState(false);
  const [addNonconformityItemId, setAddNonconformityItemId] = useState<string | null>(null);
  const [newNonconformityLabel, setNewNonconformityLabel] = useState("");

  const canManage = role === 'admin' || role === 'coordenador_servicos';

  const { data: template, isLoading } = useQuery({
    queryKey: ['checklist-template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          *,
          blocks:checklist_template_blocks(
            id,
            block_name,
            order_index,
            items:checklist_template_items(
              id,
              item_name,
              order_index,
              active,
              actions:checklist_item_corrective_actions(
                id,
                action_label,
                order_index,
                active
              ),
              nonconformities:checklist_item_nonconformities(
                id,
                nonconformity_label,
                order_index,
                active
              )
            )
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Sort blocks and items by order_index
      if (data.blocks) {
        data.blocks.sort((a: ChecklistBlock, b: ChecklistBlock) => a.order_index - b.order_index);
        data.blocks.forEach((block: ChecklistBlock) => {
          if (block.items) {
            block.items.sort((a: ChecklistItem, b: ChecklistItem) => a.order_index - b.order_index);
            block.items.forEach((item: ChecklistItem) => {
              if (item.actions) {
                item.actions.sort((a: CorrectiveAction, b: CorrectiveAction) => a.order_index - b.order_index);
              }
              if (item.nonconformities) {
                item.nonconformities.sort((a: Nonconformity, b: Nonconformity) => a.order_index - b.order_index);
              }
            });
          }
        });
      }
      
      return data;
    },
    enabled: !!id
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('checklist_templates')
        .update({ 
          name: templateName, 
          description: templateDescription || null 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      toast.success('Template atualizado!');
      setEditingTemplate(false);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Add block mutation (order_index auto-assigned by trigger)
  const addBlockMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('checklist_template_blocks')
        .insert({
          template_id: id,
          block_name: newBlockName
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Bloco adicionado!');
      setIsAddBlockOpen(false);
      setNewBlockName("");
    },
    onError: (error) => {
      toast.error('Erro ao adicionar bloco: ' + error.message);
    }
  });

  // Delete block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase
        .from('checklist_template_blocks')
        .delete()
        .eq('id', blockId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Bloco excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir bloco: ' + error.message);
    }
  });

  // Update block name mutation
  const updateBlockMutation = useMutation({
    mutationFn: async ({ blockId, blockName }: { blockId: string; blockName: string }) => {
      const { error } = await supabase
        .from('checklist_template_blocks')
        .update({ block_name: blockName })
        .eq('id', blockId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    }
  });

  // Add item mutation (order_index auto-assigned by trigger)
  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('checklist_template_items')
        .insert({
          block_id: addItemBlockId,
          item_name: newItemName
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Item adicionado!');
      setIsAddItemOpen(false);
      setNewItemName("");
      setAddItemBlockId(null);
    },
    onError: (error) => {
      toast.error('Erro ao adicionar item: ' + error.message);
    }
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('checklist_template_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Item excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir item: ' + error.message);
    }
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, itemName, active }: { itemId: string; itemName?: string; active?: boolean }) => {
      const updates: any = {};
      if (itemName !== undefined) updates.item_name = itemName;
      if (active !== undefined) updates.active = active;
      
      const { error } = await supabase
        .from('checklist_template_items')
        .update(updates)
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    }
  });

  // Duplicate item mutation
  const duplicateItemMutation = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      // Find the block containing this item
      const block = template?.blocks?.find((b: ChecklistBlock) => 
        b.items?.some((i: ChecklistItem) => i.id === item.id)
      );
      
      // Create the duplicated item (order_index auto-assigned by trigger)
      const { data: newItem, error: itemError } = await supabase
        .from('checklist_template_items')
        .insert({
          block_id: block?.id,
          item_name: `${item.item_name} (cópia)`,
          active: item.active
        })
        .select()
        .single();
      
      if (itemError) throw itemError;
      
      // Duplicate corrective actions if any exist
      if (item.actions && item.actions.length > 0) {
        const actionsToInsert = item.actions.map((action, index) => ({
          item_id: newItem.id,
          action_label: action.action_label,
          order_index: index,
          active: action.active
        }));
        
        const { error: actionsError } = await supabase
          .from('checklist_item_corrective_actions')
          .insert(actionsToInsert);
        
        if (actionsError) throw actionsError;
      }

      // Duplicate nonconformities if any exist
      if (item.nonconformities && item.nonconformities.length > 0) {
        const ncsToInsert = item.nonconformities.map((nc, index) => ({
          item_id: newItem.id,
          nonconformity_label: nc.nonconformity_label,
          order_index: index,
          active: nc.active
        }));
        
        const { error: ncsError } = await supabase
          .from('checklist_item_nonconformities')
          .insert(ncsToInsert);
        
        if (ncsError) throw ncsError;
      }
      
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Item duplicado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao duplicar item: ' + error.message);
    }
  });

  // Add action mutation
  const addActionMutation = useMutation({
    mutationFn: async () => {
      let maxOrder = 0;
      template?.blocks?.forEach((block: ChecklistBlock) => {
        const item = block.items?.find((i: ChecklistItem) => i.id === addActionItemId);
        if (item) {
          maxOrder = item.actions?.length || 0;
        }
      });
      
      const { error } = await supabase
        .from('checklist_item_corrective_actions')
        .insert({
          item_id: addActionItemId,
          action_label: newActionLabel,
          order_index: maxOrder
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Ação corretiva adicionada!');
      setIsAddActionOpen(false);
      setNewActionLabel("");
      setAddActionItemId(null);
    },
    onError: (error) => {
      toast.error('Erro ao adicionar ação: ' + error.message);
    }
  });

  // Delete action mutation
  const deleteActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('checklist_item_corrective_actions')
        .delete()
        .eq('id', actionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Ação excluída!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir ação: ' + error.message);
    }
  });

  // Update action mutation
  const updateActionMutation = useMutation({
    mutationFn: async ({ actionId, actionLabel, active }: { actionId: string; actionLabel?: string; active?: boolean }) => {
      const updates: any = {};
      if (actionLabel !== undefined) updates.action_label = actionLabel;
      if (active !== undefined) updates.active = active;
      
      const { error } = await supabase
        .from('checklist_item_corrective_actions')
        .update(updates)
        .eq('id', actionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    }
  });

  // Add nonconformity mutation
  const addNonconformityMutation = useMutation({
    mutationFn: async () => {
      let maxOrder = 0;
      template?.blocks?.forEach((block: ChecklistBlock) => {
        const item = block.items?.find((i: ChecklistItem) => i.id === addNonconformityItemId);
        if (item) {
          maxOrder = item.nonconformities?.length || 0;
        }
      });
      
      const { error } = await supabase
        .from('checklist_item_nonconformities')
        .insert({
          item_id: addNonconformityItemId,
          nonconformity_label: newNonconformityLabel,
          order_index: maxOrder
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Não conformidade adicionada!');
      setIsAddNonconformityOpen(false);
      setNewNonconformityLabel("");
      setAddNonconformityItemId(null);
    },
    onError: (error) => {
      toast.error('Erro ao adicionar não conformidade: ' + error.message);
    }
  });

  // Delete nonconformity mutation
  const deleteNonconformityMutation = useMutation({
    mutationFn: async (ncId: string) => {
      const { error } = await supabase
        .from('checklist_item_nonconformities')
        .delete()
        .eq('id', ncId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
      toast.success('Não conformidade excluída!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir não conformidade: ' + error.message);
    }
  });

  // Update nonconformity mutation
  const updateNonconformityMutation = useMutation({
    mutationFn: async ({ ncId, ncLabel, active }: { ncId: string; ncLabel?: string; active?: boolean }) => {
      const updates: any = {};
      if (ncLabel !== undefined) updates.nonconformity_label = ncLabel;
      if (active !== undefined) updates.active = active;
      
      const { error } = await supabase
        .from('checklist_item_nonconformities')
        .update(updates)
        .eq('id', ncId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    }
  });

  // Reorder blocks mutation (transactional RPC, 1-based)
  const reorderBlocksMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabase.rpc('reorder_checklist_blocks', {
        p_template_id: id,
        p_ordered_ids: orderedIds
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    },
    onError: (error) => {
      toast.error('Erro ao reordenar blocos: ' + error.message);
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    }
  });

  // Reorder items mutation (transactional RPC, 1-based)
  const reorderItemsMutation = useMutation({
    mutationFn: async ({ blockId, orderedIds }: { blockId: string; orderedIds: string[] }) => {
      const { error } = await supabase.rpc('reorder_checklist_items', {
        p_block_id: blockId,
        p_ordered_ids: orderedIds
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    },
    onError: (error) => {
      toast.error('Erro ao reordenar itens: ' + error.message);
      queryClient.invalidateQueries({ queryKey: ['checklist-template', id] });
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleBlockDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !template?.blocks) return;

    const blocks = [...template.blocks];
    const oldIndex = blocks.findIndex((b: ChecklistBlock) => b.id === active.id);
    const newIndex = blocks.findIndex((b: ChecklistBlock) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = blocks.splice(oldIndex, 1);
    blocks.splice(newIndex, 0, moved);

    const orderedIds = blocks.map((b: ChecklistBlock) => b.id);

    // Optimistic update (1-based)
    queryClient.setQueryData(['checklist-template', id], (old: any) => {
      if (!old) return old;
      const updatedBlocks = [...old.blocks];
      const [movedBlock] = updatedBlocks.splice(oldIndex, 1);
      updatedBlocks.splice(newIndex, 0, movedBlock);
      return { ...old, blocks: updatedBlocks.map((b: any, i: number) => ({ ...b, order_index: i + 1 })) };
    });

    reorderBlocksMutation.mutate(orderedIds);
  }, [template?.blocks, id, queryClient, reorderBlocksMutation]);

  const handleItemDragEnd = useCallback((blockId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !template?.blocks) return;

    const block = template.blocks.find((b: ChecklistBlock) => b.id === blockId);
    if (!block?.items) return;

    const items = [...block.items];
    const oldIndex = items.findIndex((i: ChecklistItem) => i.id === active.id);
    const newIndex = items.findIndex((i: ChecklistItem) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, moved);

    const orderedIds = items.map((item: ChecklistItem) => item.id);

    // Optimistic update (1-based)
    queryClient.setQueryData(['checklist-template', id], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        blocks: old.blocks.map((b: any) => {
          if (b.id !== blockId) return b;
          const updatedItems = [...b.items];
          const [movedItem] = updatedItems.splice(oldIndex, 1);
          updatedItems.splice(newIndex, 0, movedItem);
          return { ...b, items: updatedItems.map((it: any, i: number) => ({ ...it, order_index: i + 1 })) };
        })
      };
    });

    reorderItemsMutation.mutate({ blockId, orderedIds });
  }, [template?.blocks, id, queryClient, reorderItemsMutation]);

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const openAddItem = (blockId: string) => {
    setAddItemBlockId(blockId);
    setIsAddItemOpen(true);
  };

  const openAddAction = (itemId: string) => {
    setAddActionItemId(itemId);
    setIsAddActionOpen(true);
  };

  const openAddNonconformity = (itemId: string) => {
    setAddNonconformityItemId(itemId);
    setIsAddNonconformityOpen(true);
  };

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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Template não encontrado.</p>
            <Button onClick={() => navigate('/preventivas/checklists')} className="mt-4">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/preventivas/checklists')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {editingTemplate ? (
            <div className="flex items-end gap-4">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input 
                  value={templateName} 
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-64"
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label>Descrição</Label>
                <Input 
                  value={templateDescription} 
                  onChange={(e) => setTemplateDescription(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => updateTemplateMutation.mutate()}
                disabled={!templateName.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setEditingTemplate(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div 
              className="cursor-pointer hover:bg-muted/50 p-2 rounded -m-2"
              onClick={() => {
                setTemplateName(template.name);
                setTemplateDescription(template.description || "");
                setEditingTemplate(true);
              }}
            >
              <h1 className="text-2xl font-bold">{template.name}</h1>
              {template.description && (
                <p className="text-muted-foreground">{template.description}</p>
              )}
            </div>
          )}
        </div>
        <Badge variant={template.active ? "default" : "secondary"}>
          {template.active ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {/* Add Block Button */}
      <Dialog open={isAddBlockOpen} onOpenChange={setIsAddBlockOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Bloco
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Bloco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Bloco *</Label>
              <Input
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="Ex: Painel de controle"
              />
            </div>
            <Button 
              onClick={() => addBlockMutation.mutate()}
              disabled={!newBlockName.trim() || addBlockMutation.isPending}
              className="w-full"
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Item *</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Ex: Placa 1"
              />
            </div>
            <Button 
              onClick={() => addItemMutation.mutate()}
              disabled={!newItemName.trim() || addItemMutation.isPending}
              className="w-full"
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Action Dialog */}
      <Dialog open={isAddActionOpen} onOpenChange={setIsAddActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Ação Corretiva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição da Ação *</Label>
              <Input
                value={newActionLabel}
                onChange={(e) => setNewActionLabel(e.target.value)}
                placeholder="Ex: Ajuste de overload"
              />
            </div>
            <Button 
              onClick={() => addActionMutation.mutate()}
              disabled={!newActionLabel.trim() || addActionMutation.isPending}
              className="w-full"
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Nonconformity Dialog */}
      <Dialog open={isAddNonconformityOpen} onOpenChange={setIsAddNonconformityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Não Conformidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição da Não Conformidade *</Label>
              <Input
                value={newNonconformityLabel}
                onChange={(e) => setNewNonconformityLabel(e.target.value)}
                placeholder="Ex: Vazamento no êmbolo"
              />
            </div>
            <Button 
              onClick={() => addNonconformityMutation.mutate()}
              disabled={!newNonconformityLabel.trim() || addNonconformityMutation.isPending}
              className="w-full"
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blocks */}
      <div className="space-y-4">
        {template.blocks?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum bloco criado ainda. Adicione blocos para organizar os itens do checklist.
              </p>
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleBlockDragEnd}
          >
            <SortableContext
              items={template.blocks?.map((b: ChecklistBlock) => b.id) || []}
              strategy={verticalListSortingStrategy}
            >
              {template.blocks?.map((block: ChecklistBlock) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  expandedBlocks={expandedBlocks}
                  expandedItems={expandedItems}
                  toggleBlock={toggleBlock}
                  toggleItem={toggleItem}
                  updateBlockMutation={updateBlockMutation}
                  deleteBlockMutation={deleteBlockMutation}
                  updateItemMutation={updateItemMutation}
                  deleteItemMutation={deleteItemMutation}
                  duplicateItemMutation={duplicateItemMutation}
                  updateActionMutation={updateActionMutation}
                  deleteActionMutation={deleteActionMutation}
                  updateNonconformityMutation={updateNonconformityMutation}
                  deleteNonconformityMutation={deleteNonconformityMutation}
                  openAddItem={openAddItem}
                  openAddAction={openAddAction}
                  openAddNonconformity={openAddNonconformity}
                  sensors={sensors}
                  handleItemDragEnd={handleItemDragEnd}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

// Sortable Block wrapper
function SortableBlock({
  block,
  expandedBlocks,
  expandedItems,
  toggleBlock,
  toggleItem,
  updateBlockMutation,
  deleteBlockMutation,
  updateItemMutation,
  deleteItemMutation,
  duplicateItemMutation,
  updateActionMutation,
  deleteActionMutation,
  updateNonconformityMutation,
  deleteNonconformityMutation,
  openAddItem,
  openAddAction,
  openAddNonconformity,
  sensors,
  handleItemDragEnd,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <Collapsible
        open={expandedBlocks.has(block.id)}
        onOpenChange={() => toggleBlock(block.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {expandedBlocks.has(block.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>
            <EditableText
              value={block.block_name}
              onSave={(value: string) => updateBlockMutation.mutate({ blockId: block.id, blockName: value })}
              className="text-lg font-semibold flex-1"
            />
            <Badge variant="secondary">{block.items?.length || 0} itens</Badge>
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
                    Tem certeza que deseja excluir "{block.block_name}"?
                    Todos os itens, ações corretivas e não conformidades serão excluídos.
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
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleItemDragEnd(block.id)}
            >
              <SortableContext
                items={block.items?.map((i: ChecklistItem) => i.id) || []}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mb-4">
                  {block.items?.map((item: ChecklistItem) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      expandedItems={expandedItems}
                      toggleItem={toggleItem}
                      updateItemMutation={updateItemMutation}
                      deleteItemMutation={deleteItemMutation}
                      duplicateItemMutation={duplicateItemMutation}
                      updateActionMutation={updateActionMutation}
                      deleteActionMutation={deleteActionMutation}
                      updateNonconformityMutation={updateNonconformityMutation}
                      deleteNonconformityMutation={deleteNonconformityMutation}
                      openAddAction={openAddAction}
                      openAddNonconformity={openAddNonconformity}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => openAddItem(block.id)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar item de verificação
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Sortable Item wrapper
function SortableItem({
  item,
  expandedItems,
  toggleItem,
  updateItemMutation,
  deleteItemMutation,
  duplicateItemMutation,
  updateActionMutation,
  deleteActionMutation,
  updateNonconformityMutation,
  deleteNonconformityMutation,
  openAddAction,
  openAddNonconformity,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg">
      <Collapsible
        open={expandedItems.has(item.id)}
        onOpenChange={() => toggleItem(item.id)}
      >
        <div className="flex items-center gap-3 p-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {expandedItems.has(item.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <EditableText
            value={item.item_name}
            onSave={(value: string) => updateItemMutation.mutate({ itemId: item.id, itemName: value })}
            className="flex-1"
          />
          <Badge variant="outline" className="text-xs">
            {item.nonconformities?.length || 0} NC | {item.actions?.length || 0} ações
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ativo</span>
            <Switch
              checked={item.active}
              onCheckedChange={(checked: boolean) =>
                updateItemMutation.mutate({ itemId: item.id, active: checked })
              }
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => duplicateItemMutation.mutate(item)}
            disabled={duplicateItemMutation.isPending}
            title="Duplicar item"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="h-3 w-3" />
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
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pl-12 space-y-4">
            {/* Nonconformities Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Não Conformidades (o que deu errado)
              </div>
              {item.nonconformities?.map((nc: Nonconformity) => (
                <div key={nc.id} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                  <EditableText
                    value={nc.nonconformity_label}
                    onSave={(value: string) => updateNonconformityMutation.mutate({ ncId: nc.id, ncLabel: value })}
                    className="flex-1 text-sm"
                  />
                  <NonconformityPartsManager
                    nonconformityId={nc.id}
                    nonconformityLabel={nc.nonconformity_label}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={nc.active}
                      onCheckedChange={(checked: boolean) =>
                        updateNonconformityMutation.mutate({ ncId: nc.id, active: checked })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => deleteNonconformityMutation.mutate(nc.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => openAddNonconformity(item.id)}
              >
                <Plus className="h-3 w-3 mr-2" />
                Adicionar não conformidade
              </Button>
            </div>

            {/* Corrective Actions Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wrench className="h-4 w-4" />
                Ações Corretivas (o que foi feito para corrigir)
              </div>
              {item.actions?.map((action: CorrectiveAction) => (
                <div key={action.id} className="flex items-center gap-2 bg-muted/50 rounded p-2">
                  <EditableText
                    value={action.action_label}
                    onSave={(value: string) => updateActionMutation.mutate({ actionId: action.id, actionLabel: value })}
                    className="flex-1 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={action.active}
                      onCheckedChange={(checked: boolean) =>
                        updateActionMutation.mutate({ actionId: action.id, active: checked })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => deleteActionMutation.mutate(action.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => openAddAction(item.id)}
              >
                <Plus className="h-3 w-3 mr-2" />
                Adicionar ação corretiva
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Editable text component
function EditableText({
  value,
  onSave,
  className
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setEditValue(value);
            setIsEditing(false);
          }
        }}
        autoFocus
        className={className}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:bg-muted/50 px-2 py-1 rounded ${className}`}
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value}
    </span>
  );
}
