import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, Loader2, Wrench } from "lucide-react";
import ChecklistItemStatusButtons from "./ChecklistItemStatusButtons";
import SelectableOptionCard from "./SelectableOptionCard";
import ChecklistBlockNav from "./ChecklistBlockNav";
import ChecklistFloatingProgress from "./ChecklistFloatingProgress";
import ChecklistItemNotes from "./ChecklistItemNotes";
interface ChecklistExecutionProps {
  preventiveId: string;
  routeTemplateId?: string; // Template ID from route - auto-start if provided
  onComplete?: () => void;
}

interface AvailableAction {
  id: string;
  action_label: string;
  order_index: number;
  active: boolean;
}

interface AvailableNonconformity {
  id: string;
  nonconformity_label: string;
  order_index: number;
  active: boolean;
}

interface ExecItem {
  id: string;
  item_name_snapshot: string;
  order_index: number;
  status: 'S' | 'N' | 'NA' | null;
  notes: string | null;
  answered_at: string | null;
  template_item_id: string | null;
  selectedActions: string[];
  selectedNonconformities: string[];
  availableActions: AvailableAction[];
  availableNonconformities: AvailableNonconformity[];
}

interface ExecBlock {
  id: string;
  block_name_snapshot: string;
  order_index: number;
  items: ExecItem[];
}

type ChecklistStatus = 'em_andamento' | 'concluido';

export default function ChecklistExecution({ preventiveId, routeTemplateId, onComplete }: ChecklistExecutionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSelectTemplateOpen, setIsSelectTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isConfirmCompleteOpen, setIsConfirmCompleteOpen] = useState(false);
  const autoStartAttempted = useRef(false);
  const [autoStartState, setAutoStartState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [autoStartError, setAutoStartError] = useState<string | null>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Get existing checklist for this preventive
  const { data: existingChecklist, isLoading: loadingChecklist } = useQuery({
    queryKey: ['preventive-checklist', preventiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_checklists')
        .select(`
          *,
          template:checklist_templates(name),
          blocks:preventive_checklist_blocks(
            id,
            block_name_snapshot,
            order_index,
            items:preventive_checklist_items(
              id,
              item_name_snapshot,
              order_index,
              status,
              notes,
              answered_at,
              template_item_id,
              selected_actions:preventive_checklist_item_actions(
                id,
                template_action_id,
                action_label_snapshot
              ),
              selected_nonconformities:preventive_checklist_item_nonconformities(
                id,
                template_nonconformity_id,
                nonconformity_label_snapshot
              )
            )
          )
        `)
        .eq('preventive_id', preventiveId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Get available templates
  const { data: templates } = useQuery({
    queryKey: ['active-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, description')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !existingChecklist && !routeTemplateId
  });

  // Get corrective actions for template items
  const { data: templateActions } = useQuery({
    queryKey: ['template-corrective-actions', existingChecklist?.id],
    queryFn: async () => {
      if (!existingChecklist) return {};
      
      // Get all template item IDs from the checklist
      const templateItemIds: string[] = [];
      existingChecklist.blocks?.forEach((block: any) => {
        block.items?.forEach((item: any) => {
          if (item.template_item_id) {
            templateItemIds.push(item.template_item_id);
          }
        });
      });

      if (templateItemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('checklist_item_corrective_actions')
        .select('*')
        .in('item_id', templateItemIds)
        .eq('active', true)
        .order('order_index');

      if (error) throw error;

      // Group by item_id
      const grouped: Record<string, typeof data> = {};
      data?.forEach(action => {
        if (!grouped[action.item_id]) {
          grouped[action.item_id] = [];
        }
        grouped[action.item_id].push(action);
      });

      return grouped;
    },
    enabled: !!existingChecklist
  });

  // Get nonconformities for template items
  const { data: templateNonconformities } = useQuery({
    queryKey: ['template-nonconformities', existingChecklist?.id],
    queryFn: async () => {
      if (!existingChecklist) return {};
      
      const templateItemIds: string[] = [];
      existingChecklist.blocks?.forEach((block: any) => {
        block.items?.forEach((item: any) => {
          if (item.template_item_id) {
            templateItemIds.push(item.template_item_id);
          }
        });
      });

      if (templateItemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('checklist_item_nonconformities')
        .select('*')
        .in('item_id', templateItemIds)
        .eq('active', true)
        .order('order_index');

      if (error) throw error;

      // Group by item_id
      const grouped: Record<string, typeof data> = {};
      data?.forEach(nc => {
        if (!grouped[nc.item_id]) {
          grouped[nc.item_id] = [];
        }
        grouped[nc.item_id].push(nc);
      });

      return grouped;
    },
    enabled: !!existingChecklist
  });

  // Create checklist from template
  const createChecklistMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Get template structure
      const { data: template, error: templateError } = await supabase
        .from('checklist_templates')
        .select(`
          id,
          name,
          blocks:checklist_template_blocks(
            id,
            block_name,
            order_index,
            items:checklist_template_items(
              id,
              item_name,
              order_index,
              active
            )
          )
        `)
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('preventive_checklists')
        .insert({
          preventive_id: preventiveId,
          template_id: templateId
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create snapshot blocks and items
      for (const block of template.blocks || []) {
        const { data: execBlock, error: blockError } = await supabase
          .from('preventive_checklist_blocks')
          .insert({
            checklist_id: checklist.id,
            template_block_id: block.id,
            block_name_snapshot: block.block_name,
            order_index: block.order_index
          })
          .select()
          .single();

        if (blockError) throw blockError;

        // Create items
        const activeItems = block.items?.filter((item: any) => item.active) || [];
        if (activeItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('preventive_checklist_items')
            .insert(
              activeItems.map((item: any) => ({
                exec_block_id: execBlock.id,
                template_item_id: item.id,
                item_name_snapshot: item.item_name,
                order_index: item.order_index
              }))
            );

          if (itemsError) throw itemsError;
        }
      }

      return checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      toast.success('Checklist iniciado!');
      setIsSelectTemplateOpen(false);
      setAutoStartState('idle');
      setAutoStartError(null);
    },
    onError: (error) => {
      toast.error('Erro ao iniciar checklist: ' + error.message);
      setAutoStartState('failed');
      setAutoStartError(error.message);
    }
  });

  const retryAutoStart = () => {
    if (!routeTemplateId) return;
    setAutoStartState('pending');
    setAutoStartError(null);
    createChecklistMutation.mutate(routeTemplateId);
  };

  // Scroll to block function - must be before any conditional returns
  const scrollToBlock = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
    const element = blockRefs.current[blockId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Auto-start checklist if routeTemplateId is provided and no checklist exists
  useEffect(() => {
    if (!existingChecklist && routeTemplateId && !loadingChecklist && !autoStartAttempted.current && !createChecklistMutation.isPending) {
      console.log('[ChecklistExecution] Auto-starting with template:', routeTemplateId);
      autoStartAttempted.current = true;
      setAutoStartState('pending');
      setAutoStartError(null);
      createChecklistMutation.mutate(routeTemplateId);
    }
  }, [existingChecklist, routeTemplateId, loadingChecklist, createChecklistMutation.isPending]);

  // Set initial active block when blocks data is available
  useEffect(() => {
    if (existingChecklist?.blocks && existingChecklist.blocks.length > 0 && !activeBlockId) {
      setActiveBlockId(existingChecklist.blocks[0].id);
    }
  }, [existingChecklist?.blocks, activeBlockId]);

  // Update item status
  const updateItemMutation = useMutation({
    mutationFn: async ({ 
      itemId, 
      status, 
      notes 
    }: { 
      itemId: string; 
      status?: 'S' | 'N' | 'NA' | null;
      notes?: string;
    }) => {
      const updates: any = {
        answered_at: new Date().toISOString()
      };
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      const { error } = await supabase
        .from('preventive_checklist_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      // If status changed from N to something else, remove selected actions, nonconformities and their consumption records
      if (status && status !== 'N') {
        // Get all exec_nonconformity_ids for this item
        const { data: execNonconformities } = await supabase
          .from('preventive_checklist_item_nonconformities')
          .select('id')
          .eq('exec_item_id', itemId);
        
        if (execNonconformities && execNonconformities.length > 0) {
          const ncIds = execNonconformities.map(nc => nc.id);
          
          // Remove associated part consumption records
          // Note: Using 'as any' because types are not yet regenerated after migration
          await (supabase as any)
            .from('preventive_part_consumption')
            .delete()
            .in('exec_nonconformity_id', ncIds);
        }
        
        // Remove the actions themselves
        await supabase
          .from('preventive_checklist_item_actions')
          .delete()
          .eq('exec_item_id', itemId);

        // Remove the nonconformities
        await supabase
          .from('preventive_checklist_item_nonconformities')
          .delete()
          .eq('exec_item_id', itemId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Toggle corrective action (no longer handles part consumption - that's done via nonconformities)
  const toggleActionMutation = useMutation({
    mutationFn: async ({ 
      itemId, 
      actionId, 
      actionLabel,
      isSelected 
    }: { 
      itemId: string;
      actionId: string; 
      actionLabel: string;
      isSelected: boolean;
    }) => {
      if (isSelected) {
        // Remove action
        const { error } = await supabase
          .from('preventive_checklist_item_actions')
          .delete()
          .eq('exec_item_id', itemId)
          .eq('template_action_id', actionId);

        if (error) throw error;
      } else {
        // Add action
        const { error } = await supabase
          .from('preventive_checklist_item_actions')
          .insert({
            exec_item_id: itemId,
            template_action_id: actionId,
            action_label_snapshot: actionLabel
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ação: ' + error.message);
    }
  });

  // Toggle nonconformity (now handles part consumption)
  const toggleNonconformityMutation = useMutation({
    mutationFn: async ({ 
      itemId, 
      nonconformityId, 
      nonconformityLabel,
      isSelected 
    }: { 
      itemId: string;
      nonconformityId: string; 
      nonconformityLabel: string;
      isSelected: boolean;
    }) => {
      if (isSelected) {
        // Remove nonconformity - first get the exec_nonconformity_id
        const { data: execNc } = await supabase
          .from('preventive_checklist_item_nonconformities')
          .select('id')
          .eq('exec_item_id', itemId)
          .eq('template_nonconformity_id', nonconformityId)
          .maybeSingle();
        
        if (execNc) {
          // Remove associated part consumption records
          // Note: Using 'as any' because types are not yet regenerated after migration
          await (supabase as any)
            .from('preventive_part_consumption')
            .delete()
            .eq('exec_nonconformity_id', execNc.id);
        }
        
        // Remove nonconformity
        const { error } = await supabase
          .from('preventive_checklist_item_nonconformities')
          .delete()
          .eq('exec_item_id', itemId)
          .eq('template_nonconformity_id', nonconformityId);

        if (error) throw error;
      } else {
        // Add nonconformity
        const { data: newNc, error } = await supabase
          .from('preventive_checklist_item_nonconformities')
          .insert({
            exec_item_id: itemId,
            template_nonconformity_id: nonconformityId,
            nonconformity_label_snapshot: nonconformityLabel
          })
          .select()
          .single();

        if (error) throw error;
        
        // Get associated parts for this nonconformity
        // Note: Using 'as any' because types are not yet regenerated after migration
        const { data: ncParts } = await (supabase as any)
          .from('checklist_nonconformity_parts')
          .select(`
            id,
            part_id,
            default_quantity,
            part:pecas(codigo, nome)
          `)
          .eq('nonconformity_id', nonconformityId);
        
        // Create part consumption records
        if (ncParts && ncParts.length > 0 && newNc) {
          const consumptionRecords = ncParts.map((np: any) => ({
            preventive_id: preventiveId,
            exec_item_id: itemId,
            exec_nonconformity_id: newNc.id,
            part_id: np.part_id,
            part_code_snapshot: np.part?.codigo || '',
            part_name_snapshot: np.part?.nome || '',
            quantity: np.default_quantity
          }));
          
          // Note: Using 'as any' because types are not yet regenerated after migration
          const { error: consumptionError } = await (supabase as any)
            .from('preventive_part_consumption')
            .insert(consumptionRecords);
          
          if (consumptionError) {
            console.error('Erro ao registrar consumo de peças:', consumptionError);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      toast.error('Erro ao atualizar não conformidade: ' + error.message);
    }
  });

  // Complete checklist
  const completeChecklistMutation = useMutation({
    mutationFn: async () => {
      if (!existingChecklist) throw new Error('Checklist não encontrado');

      const { error } = await supabase
        .from('preventive_checklists')
        .update({
          status: 'concluido' as ChecklistStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingChecklist.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      toast.success('Checklist concluído!');
      setIsConfirmCompleteOpen(false);
      onComplete?.();
    },
    onError: (error) => {
      toast.error('Erro ao concluir: ' + error.message);
    }
  });

  // Show loading while fetching or auto-creating checklist
  if (loadingChecklist || (routeTemplateId && !existingChecklist && (autoStartState === 'pending' || createChecklistMutation.isPending))) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {createChecklistMutation.isPending ? 'Iniciando checklist...' : 'Carregando...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Auto-start attempted but checklist didn't appear (avoid frozen screen)
  if (routeTemplateId && !existingChecklist && autoStartAttempted.current && autoStartState !== 'pending') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-start gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="break-words">Não foi possível iniciar o checklist</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {autoStartError ? `Detalhe: ${autoStartError}` : 'A criação automática não retornou um checklist.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="w-full sm:w-auto" onClick={retryAutoStart} disabled={createChecklistMutation.isPending}>
              {createChecklistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tentar novamente
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setIsSelectTemplateOpen(true)}>
              Selecionar template
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No checklist started and no routeTemplateId - show template selection (fallback)
  if (!existingChecklist) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5" />
              Checklist de Preventiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Nenhum checklist foi iniciado para esta preventiva.
            </p>
            <Button onClick={() => setIsSelectTemplateOpen(true)} className="w-full">
              Iniciar Checklist
            </Button>
          </CardContent>
        </Card>

        <Dialog open={isSelectTemplateOpen} onOpenChange={setIsSelectTemplateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar Template</DialogTitle>
              <DialogDescription>
                Escolha o template de checklist para esta preventiva.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedTemplateId || ''} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum template ativo encontrado. Crie um template primeiro.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSelectTemplateOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => selectedTemplateId && createChecklistMutation.mutate(selectedTemplateId)}
                disabled={!selectedTemplateId || createChecklistMutation.isPending}
              >
                {createChecklistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Iniciar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Calculate progress
  const blocks: ExecBlock[] = existingChecklist.blocks?.map((block: any) => ({
    ...block,
    items: block.items?.map((item: any) => ({
      ...item,
      selectedActions: item.selected_actions?.map((a: any) => a.template_action_id) || [],
      selectedNonconformities: item.selected_nonconformities?.map((nc: any) => nc.template_nonconformity_id) || [],
      availableActions: templateActions?.[item.template_item_id] || [],
      availableNonconformities: templateNonconformities?.[item.template_item_id] || []
    })).sort((a: ExecItem, b: ExecItem) => a.order_index - b.order_index) || []
  })).sort((a: ExecBlock, b: ExecBlock) => a.order_index - b.order_index) || [];

  const totalItems = blocks.reduce((acc, block) => acc + block.items.length, 0);
  const answeredItems = blocks.reduce(
    (acc, block) => acc + block.items.filter(item => item.status !== null).length, 
    0
  );
  const progress = totalItems > 0 ? (answeredItems / totalItems) * 100 : 0;
  const isCompleted = existingChecklist.status === 'concluido';
  const allAnswered = answeredItems === totalItems;

  // Check if any item with status N has no corrective actions selected (only if actions are available)
  const hasIncompleteFailures = blocks.some(block => 
    block.items.some(item => 
      item.status === 'N' && item.selectedActions.length === 0 && item.availableActions.length > 0
    )
  );

  // Prepare blocks for navigation
  const navBlocks = blocks.map(block => ({
    id: block.id,
    block_name_snapshot: block.block_name_snapshot,
    answeredCount: block.items.filter(item => item.status !== null).length,
    totalCount: block.items.length
  }));

  return (
    <>
      {/* Extra bottom margin ensures content can scroll above the fixed progress bar on mobile */}
      <Card className="mb-36">
        <CardHeader className="pb-3 space-y-3 overflow-visible">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base leading-tight min-w-0 flex-1">
              <ClipboardCheck className="h-5 w-5 shrink-0" />
              <span className="truncate">{existingChecklist.template?.name}</span>
            </CardTitle>
            <Badge variant={isCompleted ? "default" : "secondary"} className="shrink-0 text-xs">
              {isCompleted ? "Concluído" : "Em andamento"}
            </Badge>
          </div>
          
          {/* Block Navigation Chips */}
          {!isCompleted && blocks.length > 1 && (
            <div className="-mx-6 px-6 overflow-visible">
              <ChecklistBlockNav 
                blocks={navBlocks}
                activeBlockId={activeBlockId}
                onBlockClick={scrollToBlock}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {blocks.map((block) => (
            <div 
              key={block.id} 
              ref={(el) => { blockRefs.current[block.id] = el; }}
              className="space-y-3 scroll-mt-4"
            >
              <h3 className="font-semibold text-lg border-b pb-2 flex items-center justify-between">
                <span>{block.block_name_snapshot}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {block.items.filter(i => i.status !== null).length}/{block.items.length}
                </span>
              </h3>
              <div className="space-y-4">
                {block.items.map((item) => (
                  <div 
                    key={item.id} 
                    className={`border rounded-lg p-4 space-y-3 ${
                      item.status === 'N' ? 'border-destructive/50 bg-destructive/5' : ''
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{item.item_name_snapshot}</span>
                        {isCompleted && <StatusBadge status={item.status} />}
                      </div>
                      {!isCompleted && (
                        <ChecklistItemStatusButtons
                          value={item.status}
                          onChange={(status) => 
                            updateItemMutation.mutate({ 
                              itemId: item.id, 
                              status 
                            })
                          }
                        />
                      )}
                    </div>

                    {/* Nonconformities - only show when status is N */}
                    {item.status === 'N' && item.availableNonconformities.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <p className="text-sm font-semibold">O que deu errado?</p>
                        </div>
                        <div className="space-y-2">
                          {item.availableNonconformities.map((nc) => {
                            const isSelected = item.selectedNonconformities.includes(nc.id);
                            return (
                              <SelectableOptionCard
                                key={nc.id}
                                label={nc.nonconformity_label}
                                selected={isSelected}
                                disabled={isCompleted}
                                variant="warning"
                                onClick={() => 
                                  toggleNonconformityMutation.mutate({
                                    itemId: item.id,
                                    nonconformityId: nc.id,
                                    nonconformityLabel: nc.nonconformity_label,
                                    isSelected
                                  })
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Corrective actions - only show when status is N */}
                    {item.status === 'N' && item.availableActions.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                          <Wrench className="h-4 w-4 shrink-0" />
                          <p className="text-sm font-semibold">O que foi feito para corrigir?</p>
                        </div>
                        <div className="space-y-2">
                          {item.availableActions.map((action) => {
                            const isSelected = item.selectedActions.includes(action.id);
                            return (
                              <SelectableOptionCard
                                key={action.id}
                                label={action.action_label}
                                selected={isSelected}
                                disabled={isCompleted}
                                variant="default"
                                onClick={() => 
                                  toggleActionMutation.mutate({
                                    itemId: item.id,
                                    actionId: action.id,
                                    actionLabel: action.action_label,
                                    isSelected
                                  })
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Show selected nonconformities when completed */}
                    {isCompleted && item.status === 'N' && item.selectedNonconformities.length > 0 && (
                      <div className="pl-4 border-l-2 border-amber-400">
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Não conformidades identificadas:
                        </p>
                        <ul className="text-sm list-disc list-inside">
                          {existingChecklist.blocks
                            ?.find((b: any) => b.id === block.id)
                            ?.items?.find((i: any) => i.id === item.id)
                            ?.selected_nonconformities?.map((nc: any) => (
                              <li key={nc.id}>{nc.nonconformity_label_snapshot}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {/* Show selected actions when completed */}
                    {isCompleted && item.status === 'N' && item.selectedActions.length > 0 && (
                      <div className="pl-4 border-l-2 border-destructive/30">
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Ações corretivas realizadas:
                        </p>
                        <ul className="text-sm list-disc list-inside">
                          {existingChecklist.blocks
                            ?.find((b: any) => b.id === block.id)
                            ?.items?.find((i: any) => i.id === item.id)
                            ?.selected_actions?.map((action: any) => (
                              <li key={action.id}>{action.action_label_snapshot}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes */}
                    {!isCompleted ? (
                      <ChecklistItemNotes
                        itemId={item.id}
                        initialValue={item.notes}
                        onSave={async (itemId, notes) => {
                          setIsSaving(true);
                          await updateItemMutation.mutateAsync({ itemId, notes });
                          setIsSaving(false);
                          setLastSavedAt(new Date());
                        }}
                      />
                    ) : item.notes ? (
                      <p className="text-sm text-muted-foreground">
                        <strong>Obs:</strong> {item.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

        </CardContent>
      </Card>

      {/* Floating Progress Bar */}
      {!isCompleted && (
        <ChecklistFloatingProgress
          answered={answeredItems}
          total={totalItems}
          onComplete={() => setIsConfirmCompleteOpen(true)}
          disabled={completeChecklistMutation.isPending}
          hasWarnings={hasIncompleteFailures}
          isSaving={isSaving || updateItemMutation.isPending || toggleActionMutation.isPending || toggleNonconformityMutation.isPending}
          lastSavedAt={lastSavedAt}
        />
      )}

      <AlertDialog open={isConfirmCompleteOpen} onOpenChange={setIsConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja concluir o checklist? 
              Após a conclusão, não será possível editar as respostas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => completeChecklistMutation.mutate()}
              disabled={completeChecklistMutation.isPending}
            >
              {completeChecklistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusBadge({ status }: { status: 'S' | 'N' | 'NA' | null }) {
  if (!status) return null;

  const config = {
    S: { label: 'OK', variant: 'default' as const, className: 'bg-green-500' },
    N: { label: 'Falha', variant: 'destructive' as const, className: '' },
    NA: { label: 'N/A', variant: 'secondary' as const, className: '' }
  };

  const c = config[status];
  return (
    <Badge variant={c.variant} className={c.className}>
      {c.label}
    </Badge>
  );
}
