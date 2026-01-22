import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";

interface ChecklistExecutionProps {
  preventiveId: string;
  onComplete?: () => void;
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
  availableActions: Array<{
    id: string;
    action_label: string;
    order_index: number;
    active: boolean;
  }>;
}

interface ExecBlock {
  id: string;
  block_name_snapshot: string;
  order_index: number;
  items: ExecItem[];
}

type ChecklistStatus = 'em_andamento' | 'concluido';

export default function ChecklistExecution({ preventiveId, onComplete }: ChecklistExecutionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSelectTemplateOpen, setIsSelectTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isConfirmCompleteOpen, setIsConfirmCompleteOpen] = useState(false);

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
    enabled: !existingChecklist
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
    },
    onError: (error) => {
      toast.error('Erro ao iniciar checklist: ' + error.message);
    }
  });

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

      // If status changed from N to something else, remove selected actions and their consumption records
      if (status && status !== 'N') {
        // Get all exec_action_ids for this item
        const { data: execActions } = await supabase
          .from('preventive_checklist_item_actions')
          .select('id')
          .eq('exec_item_id', itemId);
        
        if (execActions && execActions.length > 0) {
          const actionIds = execActions.map(a => a.id);
          
          // Remove associated part consumption records
          await supabase
            .from('preventive_part_consumption')
            .delete()
            .in('exec_action_id', actionIds);
        }
        
        // Remove the actions themselves
        const { error: deleteError } = await supabase
          .from('preventive_checklist_item_actions')
          .delete()
          .eq('exec_item_id', itemId);

        if (deleteError) throw deleteError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Toggle corrective action
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
        // Remove action - first get the exec_action_id
        const { data: execAction } = await supabase
          .from('preventive_checklist_item_actions')
          .select('id')
          .eq('exec_item_id', itemId)
          .eq('template_action_id', actionId)
          .single();
        
        if (execAction) {
          // Remove associated part consumption records
          await supabase
            .from('preventive_part_consumption')
            .delete()
            .eq('exec_action_id', execAction.id);
        }
        
        // Remove action
        const { error } = await supabase
          .from('preventive_checklist_item_actions')
          .delete()
          .eq('exec_item_id', itemId)
          .eq('template_action_id', actionId);

        if (error) throw error;
      } else {
        // Add action
        const { data: newAction, error } = await supabase
          .from('preventive_checklist_item_actions')
          .insert({
            exec_item_id: itemId,
            template_action_id: actionId,
            action_label_snapshot: actionLabel
          })
          .select()
          .single();

        if (error) throw error;
        
        // Get associated parts for this action
        const { data: actionParts } = await supabase
          .from('checklist_action_parts')
          .select(`
            id,
            part_id,
            default_quantity,
            part:pecas(codigo, nome)
          `)
          .eq('action_id', actionId);
        
        // Create part consumption records
        if (actionParts && actionParts.length > 0 && newAction) {
          const consumptionRecords = actionParts.map(ap => ({
            preventive_id: preventiveId,
            exec_item_id: itemId,
            exec_action_id: newAction.id,
            part_id: ap.part_id,
            part_code_snapshot: (ap.part as any)?.codigo || '',
            part_name_snapshot: (ap.part as any)?.nome || '',
            quantity: ap.default_quantity
          }));
          
          const { error: consumptionError } = await supabase
            .from('preventive_part_consumption')
            .insert(consumptionRecords);
          
          if (consumptionError) {
            console.error('Erro ao registrar consumo de peças:', consumptionError);
            // Don't fail the whole operation, just log
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ação: ' + error.message);
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

  if (loadingChecklist) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No checklist started - show template selection
  if (!existingChecklist) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Checklist de Preventiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Nenhum checklist foi iniciado para esta preventiva.
            </p>
            <Button onClick={() => setIsSelectTemplateOpen(true)}>
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
      availableActions: templateActions?.[item.template_item_id] || []
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

  // Check if any item with status N has no corrective actions selected
  const hasIncompleteFailures = blocks.some(block => 
    block.items.some(item => 
      item.status === 'N' && item.selectedActions.length === 0 && item.availableActions.length > 0
    )
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Checklist: {existingChecklist.template?.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {answeredItems} de {totalItems} itens respondidos
              </p>
            </div>
            <Badge variant={isCompleted ? "default" : "secondary"}>
              {isCompleted ? "Concluído" : "Em andamento"}
            </Badge>
          </div>
          <Progress value={progress} className="mt-3" />
        </CardHeader>
        <CardContent className="space-y-6">
          {blocks.map((block) => (
            <div key={block.id} className="space-y-3">
              <h3 className="font-semibold text-lg border-b pb-2">
                {block.block_name_snapshot}
              </h3>
              <div className="space-y-4">
                {block.items.map((item) => (
                  <div 
                    key={item.id} 
                    className={`border rounded-lg p-4 space-y-3 ${
                      item.status === 'N' ? 'border-destructive/50 bg-destructive/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-medium">{item.item_name_snapshot}</span>
                      {!isCompleted ? (
                        <RadioGroup
                          value={item.status || ''}
                          onValueChange={(value) => 
                            updateItemMutation.mutate({ 
                              itemId: item.id, 
                              status: value as 'S' | 'N' | 'NA' 
                            })
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="S" id={`${item.id}-s`} />
                            <Label 
                              htmlFor={`${item.id}-s`} 
                              className="flex items-center gap-1 cursor-pointer text-green-600"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              OK
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="N" id={`${item.id}-n`} />
                            <Label 
                              htmlFor={`${item.id}-n`} 
                              className="flex items-center gap-1 cursor-pointer text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                              Falha
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="NA" id={`${item.id}-na`} />
                            <Label 
                              htmlFor={`${item.id}-na`} 
                              className="flex items-center gap-1 cursor-pointer text-muted-foreground"
                            >
                              <MinusCircle className="h-4 w-4" />
                              N/A
                            </Label>
                          </div>
                        </RadioGroup>
                      ) : (
                        <StatusBadge status={item.status} />
                      )}
                    </div>

                    {/* Corrective actions - only show when status is N */}
                    {item.status === 'N' && item.availableActions.length > 0 && (
                      <div className="pl-4 border-l-2 border-destructive/30 space-y-2">
                        <p className="text-sm font-medium text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Selecione as ações corretivas realizadas:
                        </p>
                        <div className="space-y-2">
                          {item.availableActions.map((action) => {
                            const isSelected = item.selectedActions.includes(action.id);
                            return (
                              <div key={action.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`action-${action.id}`}
                                  checked={isSelected}
                                  disabled={isCompleted}
                                  onCheckedChange={() => 
                                    toggleActionMutation.mutate({
                                      itemId: item.id,
                                      actionId: action.id,
                                      actionLabel: action.action_label,
                                      isSelected
                                    })
                                  }
                                />
                                <Label 
                                  htmlFor={`action-${action.id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {action.action_label}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
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
                      <Textarea
                        placeholder="Observações (opcional)"
                        value={item.notes || ''}
                        onChange={(e) => 
                          updateItemMutation.mutate({ itemId: item.id, notes: e.target.value })
                        }
                        className="text-sm"
                        rows={2}
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

          {/* Complete button */}
          {!isCompleted && (
            <div className="pt-4 border-t">
              {hasIncompleteFailures && (
                <p className="text-sm text-amber-600 mb-3 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Existem itens com falha sem ações corretivas selecionadas.
                </p>
              )}
              <Button 
                onClick={() => setIsConfirmCompleteOpen(true)}
                disabled={!allAnswered}
                className="w-full"
              >
                Concluir Checklist
              </Button>
              {!allAnswered && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Responda todos os itens para concluir
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
