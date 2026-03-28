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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, Loader2, Wrench, WifiOff, Cloud, ChevronDown, ChevronUp, CheckCircle2, RefreshCw, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import ChecklistItemStatusButtons from "./ChecklistItemStatusButtons";
import SelectableOptionCard from "./SelectableOptionCard";
import ChecklistBlockNav from "./ChecklistBlockNav";
import ChecklistItemNotes from "./ChecklistItemNotes";

interface ChecklistExecutionProps {
  preventiveId: string;
  routeTemplateId?: string;
  onStatusChange?: (status: 'not_started' | 'in_progress' | 'completed') => void;
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

export default function ChecklistExecution({ preventiveId, routeTemplateId, onStatusChange }: ChecklistExecutionProps) {
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isBlockExpanded, setIsBlockExpanded] = useState(false);
  const [isConfirmReplaceOpen, setIsConfirmReplaceOpen] = useState(false);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, 'S' | 'N' | 'NA'>>({});
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    itemId: string;
    newStatus: 'S' | 'N' | 'NA';
    hasSelections: boolean;
  } | null>(null);
  
  // Track items being processed to prevent double-clicks (ref for sync lock, state for UI)
  const processingNonconformitiesRef = useRef<Set<string>>(new Set());
  const processingActionsRef = useRef<Set<string>>(new Set());
  const [processingNonconformities, setProcessingNonconformities] = useState<Set<string>>(new Set());
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

  // Bug #2 fix: reactive isOnline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
    enabled: (!existingChecklist && !routeTemplateId) || isSelectTemplateOpen
  });

  // Helper: extract template item IDs from checklist
  const templateItemIds = existingChecklist?.blocks?.flatMap((block: any) =>
    block.items?.filter((item: any) => item.template_item_id).map((item: any) => item.template_item_id) || []
  ) || [];

  // Get corrective actions for template items
  const { data: templateActions } = useQuery<Record<string, any[]>>({
    queryKey: ['template-corrective-actions', existingChecklist?.id],
    queryFn: async () => {
      if (!existingChecklist || templateItemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('checklist_item_corrective_actions')
        .select('*')
        .in('item_id', templateItemIds)
        .eq('active', true)
        .order('order_index');

      if (error) throw error;

      const grouped: Record<string, typeof data> = {};
      data?.forEach(action => {
        if (!grouped[action.item_id]) grouped[action.item_id] = [];
        grouped[action.item_id].push(action);
      });
      return grouped;
    },
    enabled: !!existingChecklist,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Get nonconformities for template items
  const { data: templateNonconformities } = useQuery<Record<string, any[]>>({
    queryKey: ['template-nonconformities', existingChecklist?.id],
    queryFn: async () => {
      if (!existingChecklist || templateItemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('checklist_item_nonconformities')
        .select('*')
        .in('item_id', templateItemIds)
        .eq('active', true)
        .order('order_index');

      if (error) throw error;

      const grouped: Record<string, typeof data> = {};
      data?.forEach(nc => {
        if (!grouped[nc.item_id]) grouped[nc.item_id] = [];
        grouped[nc.item_id].push(nc);
      });
      return grouped;
    },
    enabled: !!existingChecklist,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Get exec_item_ids that have at least one part consumption record
  const { data: coveredExecItemIds } = useQuery<Set<string>>({
    queryKey: ['part-consumption-coverage', preventiveId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('preventive_part_consumption')
        .select('exec_item_id')
        .eq('preventive_id', preventiveId)
        .not('exec_item_id', 'is', null);

      if (error) throw error;
      return new Set((data || []).map((r: any) => r.exec_item_id));
    },
    enabled: !!existingChecklist,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  // Create checklist from template
  const createChecklistMutation = useMutation({
    mutationFn: async (templateId: string) => {
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

      const { data: checklist, error: checklistError } = await supabase
        .from('preventive_checklists')
        .insert({
          preventive_id: preventiveId,
          template_id: templateId
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

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

  // Replace checklist mutation — deletes all data and reopens template selection
  const replaceChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      // Get all block IDs
      const { data: blockIds, error: blocksErr } = await supabase
        .from('preventive_checklist_blocks')
        .select('id')
        .eq('checklist_id', checklistId);
      if (blocksErr) throw blocksErr;

      if (blockIds && blockIds.length > 0) {
        const bIds = blockIds.map(b => b.id);
        
        // Get all item IDs
        const { data: itemIds, error: itemsErr } = await supabase
          .from('preventive_checklist_items')
          .select('id')
          .in('exec_block_id', bIds);
        if (itemsErr) throw itemsErr;

        if (itemIds && itemIds.length > 0) {
          const iIds = itemIds.map(i => i.id);

          // Get nonconformity IDs for consumption cleanup
          const { data: ncIds } = await supabase
            .from('preventive_checklist_item_nonconformities')
            .select('id')
            .in('exec_item_id', iIds);

          if (ncIds && ncIds.length > 0) {
            await (supabase as any)
              .from('preventive_part_consumption')
              .delete()
              .in('exec_nonconformity_id', ncIds.map(nc => nc.id));
          }

          // Delete nonconformities
          const { error: ncDelErr } = await supabase
            .from('preventive_checklist_item_nonconformities')
            .delete()
            .in('exec_item_id', iIds);
          if (ncDelErr) throw ncDelErr;

          // Delete actions
          const { error: actDelErr } = await supabase
            .from('preventive_checklist_item_actions')
            .delete()
            .in('exec_item_id', iIds);
          if (actDelErr) throw actDelErr;
        }

        // Delete items
        const { error: itemDelErr } = await supabase
          .from('preventive_checklist_items')
          .delete()
          .in('exec_block_id', bIds);
        if (itemDelErr) throw itemDelErr;
      }

      // Delete blocks
      const { error: blockDelErr } = await supabase
        .from('preventive_checklist_blocks')
        .delete()
        .eq('checklist_id', checklistId);
      if (blockDelErr) throw blockDelErr;

      // Delete checklist
      const { error: clDelErr } = await supabase
        .from('preventive_checklists')
        .delete()
        .eq('id', checklistId);
      if (clDelErr) throw clDelErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      queryClient.refetchQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
      queryClient.refetchQueries({ queryKey: ['part-consumption-coverage', preventiveId] });
      toast.success('Checklist removido. Selecione um novo template.');
      autoStartAttempted.current = true; // prevent auto-start from firing
      setIsSelectTemplateOpen(true);
    },
    onError: (error) => {
      toast.error('Erro ao remover checklist: ' + error.message);
    }
  });

  const retryAutoStart = () => {
    if (!routeTemplateId) return;
    setAutoStartState('pending');
    setAutoStartError(null);
    createChecklistMutation.mutate(routeTemplateId);
  };

  const scrollToBlock = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
    const element = blockRefs.current[blockId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // isOnline is now reactive state (defined above)

  // Auto-start checklist if routeTemplateId is provided and no checklist exists
  useEffect(() => {
    if (!existingChecklist && routeTemplateId && !loadingChecklist && !autoStartAttempted.current && !createChecklistMutation.isPending && isOnline) {
      console.log('[ChecklistExecution] Auto-starting with template:', routeTemplateId);
      autoStartAttempted.current = true;
      setAutoStartState('pending');
      setAutoStartError(null);
      createChecklistMutation.mutate(routeTemplateId);
    }
  }, [existingChecklist, routeTemplateId, loadingChecklist, createChecklistMutation.isPending, isOnline]);

  // Set initial active block when blocks data is available
  useEffect(() => {
    if (existingChecklist?.blocks && existingChecklist.blocks.length > 0 && !activeBlockId) {
      setActiveBlockId(existingChecklist.blocks[0].id);
    }
  }, [existingChecklist?.blocks, activeBlockId]);

  // Auto-expand failure items that need treatment
  useEffect(() => {
    if (!existingChecklist?.blocks || existingChecklist.status === 'concluido') return;
    
    const itemsToExpand: string[] = [];
    existingChecklist.blocks.forEach((block: any) => {
      block.items?.forEach((item: any) => {
        if (item.status === 'N') {
          const hasNonconformities = item.selected_nonconformities?.length > 0;
          const hasActions = item.selected_actions?.length > 0;
          if (!hasNonconformities && !hasActions) {
            itemsToExpand.push(item.id);
          }
        }
      });
    });
    
    if (itemsToExpand.length > 0) {
      setExpandedItems(prev => {
        const next = new Set(prev);
        itemsToExpand.forEach(id => next.add(id));
        return next;
      });
    }
  }, [existingChecklist?.blocks, existingChecklist?.status]);

  // Update item status — direct Supabase
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
      if (!navigator.onLine) {
        throw new Error('Sem conexão');
      }

      const updateData: any = { answered_at: new Date().toISOString() };
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;

      const { data, error } = await supabase
        .from('preventive_checklist_items')
        .update(updateData)
        .eq('id', itemId)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Falha ao salvar — verifique permissões');

      // If status changed from N to something else, remove selected actions, nonconformities and their consumption records
      if (status && status !== 'N') {
        const { data: execNonconformities } = await supabase
          .from('preventive_checklist_item_nonconformities')
          .select('id')
          .eq('exec_item_id', itemId);
        
        if (execNonconformities && execNonconformities.length > 0) {
          const ncIds = execNonconformities.map(nc => nc.id);
          await (supabase as any)
            .from('preventive_part_consumption')
            .delete()
            .in('exec_nonconformity_id', ncIds);
        }
        
        await supabase
          .from('preventive_checklist_item_actions')
          .delete()
          .eq('exec_item_id', itemId);

        await supabase
          .from('preventive_checklist_item_nonconformities')
          .delete()
          .eq('exec_item_id', itemId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['preventive-checklist', preventiveId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          blocks: old.blocks?.map((block: any) => ({
            ...block,
            items: block.items?.map((item: any) => {
              if (item.id !== variables.itemId) return item;
              return {
                ...item,
                ...(variables.status !== undefined ? { status: variables.status } : {}),
                ...(variables.notes !== undefined ? { notes: variables.notes } : {}),
                answered_at: new Date().toISOString(),
                ...(variables.status && variables.status !== 'N' ? {
                  selected_actions: [],
                  selected_nonconformities: []
                } : {})
              };
            })
          }))
        };
      });
      // Optimistic: if status changed away from N, remove parts for this item from cache
      if (variables.status && variables.status !== 'N') {
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          if (!old) return old;
          return old.filter((p: any) => p.exec_item_id !== variables.itemId || p.is_manual);
        });
      }
      // Delayed reconciliation
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
        queryClient.refetchQueries({ queryKey: ['part-consumption-coverage', preventiveId] });
      }, 2000);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Helper: check if an item has a selected action containing "Troca" (via Supabase cache)
  const itemHasTrocaAction = useCallback((itemId: string): boolean => {
    const checklist = queryClient.getQueryData(['preventive-checklist', preventiveId]) as any;
    if (!checklist) return false;
    for (const block of checklist.blocks || []) {
      for (const item of block.items || []) {
        if (item.id === itemId) {
          return item.selected_actions?.some((a: any) => 
            a.action_label_snapshot?.toLowerCase().includes('troca')
          ) || false;
        }
      }
    }
    return false;
  }, [queryClient, preventiveId]);

  // Helper: get NC parts from Supabase
  const getNcParts = async (templateNcId: string) => {
    const { data, error } = await supabase
      .from('checklist_nonconformity_parts')
      .select('id, nonconformity_id, part_id, default_quantity, pecas:part_id(codigo, nome)')
      .eq('nonconformity_id', templateNcId);

    if (error || !data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      nonconformity_id: row.nonconformity_id,
      part_id: row.part_id,
      default_quantity: row.default_quantity,
      part_codigo: row.pecas?.codigo || '',
      part_nome: row.pecas?.nome || '',
    }));
  };

  // Helper: create part consumption records for all selected NCs of an item (via Supabase)
  // Returns the created parts for optimistic cache update
  const createPartConsumptionForItemNCs = async (itemId: string): Promise<any[]> => {
    const createdParts: any[] = [];
    const { data: selectedNCs, error: ncError } = await supabase
      .from('preventive_checklist_item_nonconformities')
      .select('id, template_nonconformity_id')
      .eq('exec_item_id', itemId);

    if (ncError) {
      console.error('[ChecklistExecution] Error fetching NCs for part consumption:', ncError);
      return createdParts;
    }

    if (!selectedNCs || selectedNCs.length === 0) {
      console.log('[ChecklistExecution] No NCs found for item', itemId, '- skipping part consumption creation');
      return createdParts;
    }

    console.log('[ChecklistExecution] Creating part consumption for', selectedNCs.length, 'NCs on item', itemId);

    for (const nc of selectedNCs) {
      if (!nc.template_nonconformity_id) continue;
      const ncParts = await getNcParts(nc.template_nonconformity_id);
      console.log('[ChecklistExecution] NC', nc.id, 'has', ncParts.length, 'parts configured');
      for (const np of ncParts) {
        const newId = crypto.randomUUID();
        const record = {
          id: newId,
          preventive_id: preventiveId,
          exec_item_id: itemId,
          exec_nonconformity_id: nc.id,
          part_id: np.part_id,
          part_code_snapshot: np.part_codigo,
          part_name_snapshot: np.part_nome,
          quantity: np.default_quantity,
          stock_source: null,
        };
        const { error: insertErr } = await (supabase as any)
          .from('preventive_part_consumption')
          .insert(record);
        if (insertErr) {
          console.error('[ChecklistExecution] Error inserting part consumption:', insertErr);
        } else {
          createdParts.push({
            ...record,
            unit_cost_snapshot: null,
            asset_unique_code: null,
            notes: null,
            is_manual: false,
            consumed_at: new Date().toISOString(),
            is_asset: false,
          });
        }
      }
    }
    return createdParts;
  };

  // Helper: remove all automatic part consumption for NCs of an item (via Supabase)
  const removePartConsumptionForItemNCs = async (itemId: string) => {
    const { data: selectedNCs } = await supabase
      .from('preventive_checklist_item_nonconformities')
      .select('id')
      .eq('exec_item_id', itemId);

    if (!selectedNCs) return;

    for (const nc of selectedNCs) {
      await (supabase as any)
        .from('preventive_part_consumption')
        .delete()
        .eq('exec_nonconformity_id', nc.id);
    }
  };

  // Toggle corrective action — direct Supabase + setQueryData
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
    }): Promise<{ createdParts: any[]; removedParts: boolean }> => {
      if (!navigator.onLine) {
        throw new Error('Sem conexão. Conecte-se à internet para registrar o checklist.');
      }

      const lockKey = `${itemId}-${actionId}`;
      if (processingActionsRef.current.has(lockKey)) {
        console.log('[ChecklistExecution] Action already being processed, skipping:', lockKey);
        return { createdParts: [], removedParts: false };
      }
      
      processingActionsRef.current.add(lockKey);
      setProcessingActions(new Set(processingActionsRef.current));
      
      let createdParts: any[] = [];
      let removedParts = false;

      try {
        if (isSelected) {
          // Remove action
          const { error: delErr } = await supabase
            .from('preventive_checklist_item_actions')
            .delete()
            .eq('exec_item_id', itemId)
            .eq('template_action_id', actionId);
          if (delErr) throw delErr;
        } else {
          // Add action
          const { data: insData, error: insErr } = await supabase
            .from('preventive_checklist_item_actions')
            .insert({
              exec_item_id: itemId,
              template_action_id: actionId,
              action_label_snapshot: actionLabel
            } as never)
            .select('id');
          if (insErr) throw insErr;
          if (!insData || insData.length === 0) throw new Error('Ação não salva — verifique permissões');
        }

        // Part consumption side-effects
        const isTrocaAction = actionLabel.toLowerCase().includes('troca');
        if (isTrocaAction) {
          if (isSelected) {
            // "Troca" being REMOVED → check if other Troca actions remain
            const { data: remainingActions } = await supabase
              .from('preventive_checklist_item_actions')
              .select('id, action_label_snapshot')
              .eq('exec_item_id', itemId)
              .neq('template_action_id', actionId);
            
            const hasOtherTroca = remainingActions?.some(a => 
              a.action_label_snapshot?.toLowerCase().includes('troca')
            );
            if (!hasOtherTroca) {
              await removePartConsumptionForItemNCs(itemId);
              removedParts = true;
            }
          } else {
            // "Troca" being ADDED → create consumption for all selected NCs
            createdParts = await createPartConsumptionForItemNCs(itemId);
          }
        }
      } finally {
        processingActionsRef.current.delete(lockKey);
        setProcessingActions(new Set(processingActionsRef.current));
      }

      return { createdParts, removedParts };
    },
    onSuccess: (result, variables) => {
      // Update checklist cache in-place
      queryClient.setQueryData(['preventive-checklist', preventiveId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          blocks: old.blocks?.map((block: any) => ({
            ...block,
            items: block.items?.map((item: any) => {
              if (item.id !== variables.itemId) return item;
              let updatedActions = [...(item.selected_actions || [])];
              if (variables.isSelected) {
                updatedActions = updatedActions.filter((a: any) => a.template_action_id !== variables.actionId);
              } else {
                updatedActions.push({
                  id: crypto.randomUUID(),
                  template_action_id: variables.actionId,
                  action_label_snapshot: variables.actionLabel,
                });
              }
              return { ...item, selected_actions: updatedActions };
            })
          }))
        };
      });

      // Optimistic update for parts cache
      if (result?.createdParts?.length) {
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          if (!old) return result.createdParts;
          const existingIds = new Set(old.map((p: any) => p.id));
          const newParts = result.createdParts.filter((p: any) => !existingIds.has(p.id));
          return [...old, ...newParts];
        });
      }
      if (result?.removedParts) {
        // Remove parts for this item from cache
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          if (!old) return old;
          return old.filter((p: any) => p.exec_item_id !== variables.itemId || p.is_manual);
        });
      }

      // Delayed reconciliation with backend
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
        queryClient.refetchQueries({ queryKey: ['part-consumption-coverage', preventiveId] });
      }, 2000);
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ação: ' + error.message);
    }
  });

  // Toggle nonconformity — direct Supabase + setQueryData
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
    }): Promise<{ createdParts: any[]; removedNcId: string | null }> => {
      if (!navigator.onLine) {
        throw new Error('Sem conexão. Conecte-se à internet para registrar o checklist.');
      }

      const lockKey = `${itemId}-${nonconformityId}`;
      if (processingNonconformitiesRef.current.has(lockKey)) {
        console.log('[ChecklistExecution] Nonconformity already being processed, skipping:', lockKey);
        return { createdParts: [], removedNcId: null };
      }
      
      processingNonconformitiesRef.current.add(lockKey);
      setProcessingNonconformities(new Set(processingNonconformitiesRef.current));
      
      let createdParts: any[] = [];
      let removedNcId: string | null = null;

      try {
        if (isSelected) {
          // Remove NC
          const { data: execNc } = await supabase
            .from('preventive_checklist_item_nonconformities')
            .select('id')
            .eq('exec_item_id', itemId)
            .eq('template_nonconformity_id', nonconformityId)
            .maybeSingle();
          
          if (execNc) {
            removedNcId = execNc.id;
            await (supabase as any)
              .from('preventive_part_consumption')
              .delete()
              .eq('exec_nonconformity_id', execNc.id);
          }

          await supabase
            .from('preventive_checklist_item_nonconformities')
            .delete()
            .eq('exec_item_id', itemId)
            .eq('template_nonconformity_id', nonconformityId);
        } else {
          // Add NC
          const { data: inserted, error: ncInsertErr } = await supabase
            .from('preventive_checklist_item_nonconformities')
            .insert({
              exec_item_id: itemId,
              template_nonconformity_id: nonconformityId,
              nonconformity_label_snapshot: nonconformityLabel
            } as never)
            .select('id')
            .single();

          if (ncInsertErr) {
            console.error('[ChecklistExecution] Error inserting NC:', ncInsertErr);
            throw ncInsertErr;
          }

          // NC being ADDED → create part consumption if Troca active
          if (inserted) {
            const hasTroca = itemHasTrocaAction(itemId);
            console.log('[ChecklistExecution] NC added for item', itemId, '- hasTroca:', hasTroca);
            if (hasTroca) {
              const ncParts = await getNcParts(nonconformityId);
              console.log('[ChecklistExecution] Creating parts for NC:', ncParts.length, 'parts');
              for (const np of ncParts) {
                const newId = crypto.randomUUID();
                const record = {
                  id: newId,
                  preventive_id: preventiveId,
                  exec_item_id: itemId,
                  exec_nonconformity_id: inserted.id,
                  part_id: np.part_id,
                  part_code_snapshot: np.part_codigo,
                  part_name_snapshot: np.part_nome,
                  quantity: np.default_quantity,
                  stock_source: null,
                };
                const { error: partErr } = await (supabase as any)
                  .from('preventive_part_consumption')
                  .insert(record);
                if (partErr) {
                  console.error('[ChecklistExecution] Error inserting part from NC:', partErr);
                } else {
                  createdParts.push({
                    ...record,
                    unit_cost_snapshot: null,
                    asset_unique_code: null,
                    notes: null,
                    is_manual: false,
                    consumed_at: new Date().toISOString(),
                    is_asset: false,
                  });
                }
              }
            }
          }
        }
      } finally {
        processingNonconformitiesRef.current.delete(lockKey);
        setProcessingNonconformities(new Set(processingNonconformitiesRef.current));
      }

      return { createdParts, removedNcId };
    },
    onSuccess: (result, variables) => {
      // Update checklist cache in-place
      queryClient.setQueryData(['preventive-checklist', preventiveId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          blocks: old.blocks?.map((block: any) => ({
            ...block,
            items: block.items?.map((item: any) => {
              if (item.id !== variables.itemId) return item;
              let updatedNcs = [...(item.selected_nonconformities || [])];
              if (variables.isSelected) {
                updatedNcs = updatedNcs.filter((nc: any) => nc.template_nonconformity_id !== variables.nonconformityId);
              } else {
                updatedNcs.push({
                  id: crypto.randomUUID(),
                  template_nonconformity_id: variables.nonconformityId,
                  nonconformity_label_snapshot: variables.nonconformityLabel,
                });
              }
              return { ...item, selected_nonconformities: updatedNcs };
            })
          }))
        };
      });

      // Optimistic update for parts cache
      if (result?.createdParts?.length) {
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          if (!old) return result.createdParts;
          const existingIds = new Set(old.map((p: any) => p.id));
          const newParts = result.createdParts.filter((p: any) => !existingIds.has(p.id));
          return [...old, ...newParts];
        });
      }
      if (result?.removedNcId) {
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          if (!old) return old;
          return old.filter((p: any) => p.exec_nonconformity_id !== result.removedNcId);
        });
      }

      // Delayed reconciliation with backend
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
        queryClient.refetchQueries({ queryKey: ['part-consumption-coverage', preventiveId] });
      }, 2000);
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
      onStatusChange?.('completed');
    },
    onError: (error) => {
      toast.error('Erro ao concluir: ' + error.message);
    }
  });

  // Show loading while fetching or auto-creating checklist
  if (loadingChecklist || (routeTemplateId && !existingChecklist && isOnline && (autoStartState === 'pending' || createChecklistMutation.isPending))) {
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

  // Offline and no checklist available
  if (!isOnline && !existingChecklist && !loadingChecklist) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Checklist não disponível offline. Conecte-se à internet para iniciar o checklist.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Auto-start attempted but checklist didn't appear
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

  // No checklist started - show template selection
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

  // Calculate progress — read directly from server data
  const blocks: ExecBlock[] = existingChecklist.blocks?.map((block: any) => ({
    ...block,
    items: block.items?.map((item: any) => ({
      ...item,
      status: optimisticStatuses[item.id] ?? item.status,
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

  const hasIncompleteFailures = blocks.some(block => 
    block.items.some(item => {
      if (item.status !== 'N') return false;
      const missingNonconformity = item.availableNonconformities.length > 0 && item.selectedNonconformities.length === 0;
      const missingAction = item.availableActions.length > 0 && item.selectedActions.length === 0;
      return missingNonconformity || missingAction;
    })
  );

  const navBlocks = blocks.map(block => ({
    id: block.id,
    block_name_snapshot: block.block_name_snapshot,
    answeredCount: block.items.filter(item => item.status !== null).length,
    totalCount: block.items.length
  }));

  const isSavingNow = isSaving || updateItemMutation.isPending || toggleActionMutation.isPending || toggleNonconformityMutation.isPending;
  const isAllAnswered = answeredItems === totalItems && totalItems > 0;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getSyncStatusDisplay = () => {
    if (isSavingNow) {
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Salvando...</span>
        </div>
      );
    }
    if (lastSavedAt) {
      return (
        <div className="flex items-center gap-1.5 text-success">
          <Cloud className="h-3 w-3" />
          <span>Salvo {formatTime(lastSavedAt)}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Cloud className="h-3 w-3" />
        <span>Sincronizado</span>
      </div>
    );
  };

  return (
    <>
      <Collapsible open={isBlockExpanded} onOpenChange={setIsBlockExpanded}>
        <Card className="max-w-full overflow-x-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 space-y-0 px-4 sm:px-6 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0 w-full">
                <CardTitle className="flex items-center gap-2 text-base leading-tight min-w-0 flex-1 overflow-hidden">
                  <ClipboardCheck className="h-5 w-5 shrink-0" />
                  <span className="font-semibold">Check-list</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isCompleted && (
                    <Badge variant="default" className="shrink-0 text-xs whitespace-nowrap px-2 py-1 bg-green-600 hover:bg-green-700 border-green-600">
                      Concluído
                    </Badge>
                  )}
                  {!isBlockExpanded && !isCompleted && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {answeredItems}/{totalItems}
                    </Badge>
                  )}
                  {isBlockExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            {!isCompleted && (
              <div className="px-4 sm:px-6 pb-3 space-y-3">
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-center text-xs">
                {getSyncStatusDisplay()}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{answeredItems}/{totalItems} itens</span>
                    <span className="text-muted-foreground">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <Button
                  onClick={() => setIsConfirmCompleteOpen(true)}
                  disabled={completeChecklistMutation.isPending || !isAllAnswered || !navigator.onLine}
                  className="shrink-0"
                  size="default"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Concluir
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setIsConfirmReplaceOpen(true); }}
                  disabled={replaceChecklistMutation.isPending}
                  className="text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Trocar checklist
                </Button>
              </div>

              {!navigator.onLine && isAllAnswered && (
                <p className="text-xs text-amber-600 text-center">⚠️ Reconecte para concluir</p>
              )}
              {hasIncompleteFailures && isAllAnswered && navigator.onLine && (
                <p className="text-xs text-amber-600 text-center">⚠️ Existem falhas sem tratativas</p>
              )}
              {!isAllAnswered && (
                <p className="text-xs text-muted-foreground text-center">Responda todos os itens para concluir</p>
              )}
            </div>
          </div>
        )}
        <CardContent className="space-y-6 pt-3">
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
                {block.items.map((item) => {
                  const hasFailureDetails = item.status === 'N';
                  const isExpanded = expandedItems.has(item.id);
                  const selectedCount = item.selectedNonconformities.length + item.selectedActions.length;
                  
                  const missingNonconformity = item.availableNonconformities.length > 0 && item.selectedNonconformities.length === 0;
                  const missingAction = item.availableActions.length > 0 && item.selectedActions.length === 0;
                  const needsTreatment = item.status === 'N' && hasFailureDetails && (missingNonconformity || missingAction);

                  // Check if item has a "troca" action selected but no part linked
                  const hasTrocaAction = item.status === 'N' && item.selectedActions.some(actionId => {
                    const action = item.availableActions.find(a => a.id === actionId);
                    return action && /troca/i.test(action.action_label);
                  });
                  const hasCoveredPart = coveredExecItemIds?.has(item.id) ?? false;
                  const needsPart = hasTrocaAction && !hasCoveredPart;

                  return (
                    <div 
                      key={item.id} 
                      className={`border rounded-lg p-4 space-y-3 transition-all ${
                        needsTreatment 
                          ? 'border-destructive bg-destructive/10 ring-2 ring-destructive/30 ring-offset-1' 
                          : item.status === 'N' 
                            ? 'border-destructive/50 bg-destructive/5' 
                            : ''
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1 flex-wrap">
                            <span className="font-medium">{item.item_name_snapshot}</span>
                            {needsTreatment && !isCompleted && (
                              <Badge variant="destructive" className="shrink-0 text-xs animate-pulse">
                                Pendente
                              </Badge>
                            )}
                            {needsPart && !isCompleted && (
                              <Badge variant="outline" className="shrink-0 text-xs border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                                <Package className="h-3 w-3 mr-1" />
                                Peça pendente
                              </Badge>
                            )}
                          </div>
                          {isCompleted && <StatusBadge status={item.status} />}
                        </div>
                        {!isCompleted && (
                          <ChecklistItemStatusButtons
                            value={item.status}
                            onChange={(status) => {
                              if (!navigator.onLine) {
                                toast.error('Sem conexão. Conecte-se à internet para registrar o checklist.');
                                return;
                              }
                              const hasSelections = item.selectedNonconformities.length > 0 || item.selectedActions.length > 0;
                              if (item.status === 'N' && (status === 'S' || status === 'NA') && hasSelections) {
                                setPendingStatusChange({
                                  itemId: item.id,
                                  newStatus: status,
                                  hasSelections: true
                                });
                              } else {
                                setOptimisticStatuses(prev => ({ ...prev, [item.id]: status }));
                                if (status === 'N') {
                                  setExpandedItems(prev => new Set([...prev, item.id]));
                                }
                                updateItemMutation.mutate({ 
                                  itemId: item.id, 
                                  status 
                                });
                              }
                            }}
                          />
                        )}
                      </div>

                      {hasFailureDetails && !isCompleted && (
                        <Collapsible 
                          open={isExpanded} 
                          onOpenChange={(open) => {
                            setExpandedItems(prev => {
                              const next = new Set(prev);
                              if (open) {
                                next.add(item.id);
                              } else {
                                next.delete(item.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-between text-muted-foreground hover:text-foreground"
                            >
                              <span className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                Detalhes da falha
                                {selectedCount > 0 && (
                                  <Badge variant="secondary" className="text-xs min-w-[1.5rem] justify-center">
                                    {selectedCount}
                                  </Badge>
                                )}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-4 pt-3 max-h-[60vh] overflow-y-auto">
                            {item.availableNonconformities.length === 0 && item.availableActions.length === 0 && (
                              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando tratativas...
                              </div>
                            )}
                            {/* Nonconformities */}
                            {item.availableNonconformities.length > 0 && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-amber-600">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <p className="text-sm font-semibold">O que deu errado?</p>
                                </div>
                                <div className="space-y-2">
                                  {item.availableNonconformities.map((nc) => {
                                    const isSelected = item.selectedNonconformities.includes(nc.id);
                                    const lockKey = `${item.id}-${nc.id}`;
                                    const isProcessing = processingNonconformities.has(lockKey);
                                    return (
                                      <SelectableOptionCard
                                        key={nc.id}
                                        label={nc.nonconformity_label}
                                        selected={isSelected}
                                        disabled={isCompleted}
                                        loading={isProcessing}
                                        variant="danger"
                                        onClick={() => {
                                          toggleNonconformityMutation.mutate({
                                            itemId: item.id,
                                            nonconformityId: nc.id,
                                            nonconformityLabel: nc.nonconformity_label,
                                            isSelected
                                          });
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Corrective actions */}
                            {item.availableActions.length > 0 && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary">
                                  <Wrench className="h-4 w-4 shrink-0" />
                                  <p className="text-sm font-semibold">O que foi feito para corrigir?</p>
                                </div>
                                <div className="space-y-2">
                                  {item.availableActions.map((action) => {
                                    const isSelected = item.selectedActions.includes(action.id);
                                    const lockKey = `${item.id}-${action.id}`;
                                    const isProcessing = processingActions.has(lockKey);
                                    return (
                                      <SelectableOptionCard
                                        key={action.id}
                                        label={action.action_label}
                                        selected={isSelected}
                                        disabled={isCompleted}
                                        loading={isProcessing}
                                        variant="success"
                                        onClick={() => {
                                          toggleActionMutation.mutate({
                                            itemId: item.id,
                                            actionId: action.id,
                                            actionLabel: action.action_label,
                                            isSelected
                                          });
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

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
                  );
                })}
              </div>
            </div>
          ))}

        </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

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

      <AlertDialog open={!!pendingStatusChange} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status do item?</AlertDialogTitle>
            <AlertDialogDescription>
              Este item possui não conformidades ou ações corretivas selecionadas. 
              Ao alterar para {pendingStatusChange?.newStatus === 'S' ? '"OK"' : '"N/A"'}, 
              essas seleções serão removidas e as peças consumidas associadas serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (pendingStatusChange) {
                  updateItemMutation.mutate({ 
                    itemId: pendingStatusChange.itemId, 
                    status: pendingStatusChange.newStatus 
                  });
                  setPendingStatusChange(null);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmReplaceOpen} onOpenChange={setIsConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar template de checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados preenchidos neste checklist serão apagados permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (existingChecklist?.id) {
                  replaceChecklistMutation.mutate(existingChecklist.id);
                }
                setIsConfirmReplaceOpen(false);
              }}
              disabled={replaceChecklistMutation.isPending}
            >
              {replaceChecklistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sim, trocar
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
