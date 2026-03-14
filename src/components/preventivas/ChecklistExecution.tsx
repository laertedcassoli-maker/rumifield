import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineChecklist } from "@/hooks/useOfflineChecklist";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { offlineChecklistDb } from "@/lib/offline-checklist-db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, Loader2, Wrench, WifiOff, Cloud, ChevronDown, ChevronUp, RefreshCw, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import ChecklistItemStatusButtons from "./ChecklistItemStatusButtons";
import SelectableOptionCard from "./SelectableOptionCard";
import ChecklistBlockNav from "./ChecklistBlockNav";
import ChecklistItemNotes from "./ChecklistItemNotes";

interface ChecklistExecutionProps {
  preventiveId: string;
  routeTemplateId?: string; // Template ID from route - auto-start if provided
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
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, 'S' | 'N' | 'NA'>>({});
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    itemId: string;
    newStatus: 'S' | 'N' | 'NA';
    hasSelections: boolean;
  } | null>(null);
  
  // Track items being processed to prevent double-clicks
  const [processingNonconformities, setProcessingNonconformities] = useState<Set<string>>(new Set());
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());
  
  // Optimistic selections for NCs and actions (offline-friendly instant UI)
  const [optimisticNcSelections, setOptimisticNcSelections] = useState<Record<string, Set<string>>>({});
  const [optimisticActionSelections, setOptimisticActionSelections] = useState<Record<string, Set<string>>>({});
  
  // Offline support hook
  const offlineChecklist = useOfflineChecklist();

  // Get existing checklist for this preventive
  const { data: existingChecklist, isLoading: loadingChecklist, isOnline: isChecklistOnline, refetchOffline } = useOfflineQuery({
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

      // Cache full structure for offline use
      if (data) {
        await offlineChecklistDb.cacheFullChecklist(data);
      }

      return data;
    },
    offlineFn: () => offlineChecklistDb.getCachedChecklist(preventiveId),
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

  // Helper: extract template item IDs from checklist
  const templateItemIds = existingChecklist?.blocks?.flatMap((block: any) =>
    block.items?.filter((item: any) => item.template_item_id).map((item: any) => item.template_item_id) || []
  ) || [];

  // Get corrective actions for template items (with offline fallback)
  const { data: templateActions, refetchOffline: refetchActionsOffline } = useOfflineQuery<Record<string, any[]>>({
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

      // Cache in Dexie for offline use
      if (data && data.length > 0) {
        await offlineChecklistDb.cacheTemplateActions(
          data.map(a => ({
            id: a.id,
            item_id: a.item_id,
            action_label: a.action_label,
            order_index: a.order_index,
            active: a.active,
          }))
        );
      }

      // Group by item_id
      const grouped: Record<string, typeof data> = {};
      data?.forEach(action => {
        if (!grouped[action.item_id]) grouped[action.item_id] = [];
        grouped[action.item_id].push(action);
      });
      return grouped;
    },
    offlineFn: async () => {
      if (templateItemIds.length === 0) return {};
      return offlineChecklistDb.getCachedTemplateActions(templateItemIds);
    },
    enabled: !!existingChecklist,
  });

  // Get nonconformities for template items (with offline fallback)
  const { data: templateNonconformities, refetchOffline: refetchNcsOffline } = useOfflineQuery<Record<string, any[]>>({
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

      // Cache in Dexie for offline use
      if (data && data.length > 0) {
        await offlineChecklistDb.cacheTemplateNonconformities(
          data.map(nc => ({
            id: nc.id,
            item_id: nc.item_id,
            nonconformity_label: nc.nonconformity_label,
            order_index: nc.order_index,
            active: nc.active,
          }))
        );
      }

      // Group by item_id
      const grouped: Record<string, typeof data> = {};
      data?.forEach(nc => {
        if (!grouped[nc.item_id]) grouped[nc.item_id] = [];
        grouped[nc.item_id].push(nc);
      });
      return grouped;
    },
    offlineFn: async () => {
      if (templateItemIds.length === 0) return {};
      return offlineChecklistDb.getCachedTemplateNonconformities(templateItemIds);
    },
    enabled: !!existingChecklist,
  });

  // Re-fetch offline template data when templateItemIds change (handles timing where checklist loads after initial offlineFn)
  const templateItemIdsKey = templateItemIds.join(',');
  useEffect(() => {
    if (templateItemIds.length > 0 && !isChecklistOnline) {
      refetchActionsOffline();
      refetchNcsOffline();
    }
  }, [templateItemIdsKey, isChecklistOnline]);

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

  // Auto-start checklist if routeTemplateId is provided and no checklist exists (online only)
  useEffect(() => {
    if (!existingChecklist && routeTemplateId && !loadingChecklist && !autoStartAttempted.current && !createChecklistMutation.isPending && isChecklistOnline) {
      console.log('[ChecklistExecution] Auto-starting with template:', routeTemplateId);
      autoStartAttempted.current = true;
      setAutoStartState('pending');
      setAutoStartError(null);
      createChecklistMutation.mutate(routeTemplateId);
    }
  }, [existingChecklist, routeTemplateId, loadingChecklist, createChecklistMutation.isPending, isChecklistOnline]);

  // Set initial active block when blocks data is available
  useEffect(() => {
    if (existingChecklist?.blocks && existingChecklist.blocks.length > 0 && !activeBlockId) {
      setActiveBlockId(existingChecklist.blocks[0].id);
      // Cache checklist data for offline use
      offlineChecklist.cacheChecklistData(existingChecklist.blocks);
    }
  }, [existingChecklist?.blocks, activeBlockId, offlineChecklist]);

  // Clear optimistic NC/action selections per-item when real data arrives
  useEffect(() => {
    if (!existingChecklist) return;
    existingChecklist.blocks?.forEach((block: any) => {
      block.items?.forEach((item: any) => {
        setOptimisticNcSelections(prev => {
          if (!prev[item.id]) return prev;
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        setOptimisticActionSelections(prev => {
          if (!prev[item.id]) return prev;
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      });
    });
  }, [existingChecklist]);

  // Auto-expand failure items that need treatment (no selections yet)
  useEffect(() => {
    if (!existingChecklist?.blocks || existingChecklist.status === 'concluido') return;
    
    const itemsToExpand: string[] = [];
    existingChecklist.blocks.forEach((block: any) => {
      block.items?.forEach((item: any) => {
        if (item.status === 'N') {
          const hasNonconformities = item.selected_nonconformities?.length > 0;
          const hasActions = item.selected_actions?.length > 0;
          // Expand if no selections at all
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

  // Update item status with offline support
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
      // Save locally first for offline support
      await offlineChecklist.updateItem(itemId, { status, notes });

      // If online, handle side-effects (cleanup actions/NCs/consumption when status changes from N)
      // Note: the primary update is already handled by offlineChecklist.updateItem above
      if (offlineChecklist.isOnline) {
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
      }
    },
    onSuccess: (_, variables) => {
      // Update cache in-place instead of refetching (avoids scroll reset)
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
                // Clear selections if changing away from N
                ...(variables.status && variables.status !== 'N' ? {
                  selected_actions: [],
                  selected_nonconformities: []
                } : {})
              };
            })
          }))
        };
      });
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
    },
    onError: (error) => {
      // If offline, the mutation still succeeds locally
      if (!offlineChecklist.isOnline) {
        setLastSavedAt(new Date());
        return;
      }
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Helper: check if an item has a selected action containing "Troca" (case-insensitive)
  const itemHasTrocaAction = useCallback(async (itemId: string): Promise<boolean> => {
    // Try from cached checklist data first
    if (existingChecklist?.blocks) {
      for (const block of existingChecklist.blocks) {
        for (const item of block.items || []) {
          if (item.id === itemId) {
            const found = (item.selected_actions || []).some(
              (a: any) => a.action_label_snapshot?.toLowerCase().includes('troca')
            );
            if (found) return true;
          }
        }
      }
    }
    // Fallback to Dexie for offline
    const dexieActions = await offlineChecklistDb.checklistActions
      .where('exec_item_id')
      .equals(itemId)
      .toArray();
    return dexieActions.some(a => a.action_label_snapshot?.toLowerCase().includes('troca'));
  }, [existingChecklist]);

  // Helper: create part consumption records for all selected NCs of an item
  const createPartConsumptionForItemNCs = async (itemId: string) => {
    // Get all selected NCs for this item
    const { data: selectedNCs } = await supabase
      .from('preventive_checklist_item_nonconformities')
      .select('id, template_nonconformity_id')
      .eq('exec_item_id', itemId);

    if (!selectedNCs || selectedNCs.length === 0) return;

    for (const nc of selectedNCs) {
      if (!nc.template_nonconformity_id) continue;

      const { data: ncParts } = await (supabase as any)
        .from('checklist_nonconformity_parts')
        .select(`id, part_id, default_quantity, part:pecas(codigo, nome)`)
        .eq('nonconformity_id', nc.template_nonconformity_id);

      if (ncParts && ncParts.length > 0) {
        for (const np of ncParts) {
          const { error } = await (supabase as any)
            .from('preventive_part_consumption')
            .upsert({
              preventive_id: preventiveId,
              exec_item_id: itemId,
              exec_nonconformity_id: nc.id,
              part_id: np.part_id,
              part_code_snapshot: np.part?.codigo || '',
              part_name_snapshot: np.part?.nome || '',
              quantity: np.default_quantity,
              stock_source: null
            }, {
              onConflict: 'exec_nonconformity_id,part_id',
              ignoreDuplicates: true
            });
          if (error) console.error('Erro ao registrar consumo de peça:', error);
        }
      }
    }
  };

  // Helper: remove all automatic part consumption for NCs of an item
  const removePartConsumptionForItemNCs = async (itemId: string) => {
    const { data: selectedNCs } = await supabase
      .from('preventive_checklist_item_nonconformities')
      .select('id')
      .eq('exec_item_id', itemId);

    if (selectedNCs && selectedNCs.length > 0) {
      const ncIds = selectedNCs.map(nc => nc.id);
      await (supabase as any)
        .from('preventive_part_consumption')
        .delete()
        .in('exec_nonconformity_id', ncIds)
        .or('is_manual.is.null,is_manual.eq.false');
    }
  };

  // Toggle corrective action with offline support and double-click protection
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
      const lockKey = `${itemId}-${actionId}`;
      
      // Check if already processing this action
      if (processingActions.has(lockKey)) {
        console.log('[ChecklistExecution] Action already being processed, skipping:', lockKey);
        return;
      }
      
      // Add lock
      setProcessingActions(prev => new Set(prev).add(lockKey));
      
      try {
        // Save locally first for offline support
        await offlineChecklist.toggleAction(itemId, actionId, actionLabel, isSelected);

        // If online, sync to server immediately
        // If online, handle side-effects only (part consumption)
        // Note: the primary action insert/delete is handled by offlineChecklist.toggleAction above
        if (offlineChecklist.isOnline) {
          const isTrocaAction = actionLabel.toLowerCase().includes('troca');

          if (isSelected) {
            // If removing a "Troca" action, check if there are other "Troca" actions remaining
            if (isTrocaAction) {
              let hasOtherTroca = false;
              if (existingChecklist?.blocks) {
                for (const block of existingChecklist.blocks) {
                  for (const item of block.items || []) {
                    if (item.id === itemId) {
                      hasOtherTroca = (item.selected_actions || []).some(
                        (a: any) => a.template_action_id !== actionId && a.action_label_snapshot?.toLowerCase().includes('troca')
                      );
                    }
                  }
                }
              }
              if (!hasOtherTroca) {
                await removePartConsumptionForItemNCs(itemId);
              }
            }
          } else {
            // If adding a "Troca" action, create part consumption for existing NCs
            if (isTrocaAction) {
              await createPartConsumptionForItemNCs(itemId);
            }
          }
        }
      } finally {
        // Remove lock
        setProcessingActions(prev => {
          const next = new Set(prev);
          next.delete(lockKey);
          return next;
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
      if (!offlineChecklist.isOnline) {
        refetchOffline();
      }
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      if (!offlineChecklist.isOnline) {
        setLastSavedAt(new Date());
        return;
      }
      toast.error('Erro ao atualizar ação: ' + error.message);
    }
  });

  // Toggle nonconformity with offline support, double-click protection, and part consumption
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
      const lockKey = `${itemId}-${nonconformityId}`;
      
      // Check if already processing this nonconformity
      if (processingNonconformities.has(lockKey)) {
        console.log('[ChecklistExecution] Nonconformity already being processed, skipping:', lockKey);
        return;
      }
      
      // Add lock
      setProcessingNonconformities(prev => new Set(prev).add(lockKey));
      
      try {
        // Save locally first for offline support
        await offlineChecklist.toggleNonconformity(itemId, nonconformityId, nonconformityLabel, isSelected);

        // If online, sync to server immediately
        // If online, handle side-effects only (part consumption)
        // Note: the primary NC insert/delete is handled by offlineChecklist.toggleNonconformity above
        if (offlineChecklist.isOnline) {
          if (isSelected) {
            // Remove associated part consumption records
            const { data: execNc } = await supabase
              .from('preventive_checklist_item_nonconformities')
              .select('id')
              .eq('exec_item_id', itemId)
              .eq('template_nonconformity_id', nonconformityId)
              .maybeSingle();
            
            if (execNc) {
              await (supabase as any)
                .from('preventive_part_consumption')
                .delete()
                .eq('exec_nonconformity_id', execNc.id);
            }
          } else {
            // Only create part consumption if item has a "Troca" action selected
            const hasTrocaAction = itemHasTrocaAction(itemId);
            
            if (hasTrocaAction) {
              // Get the exec NC id (just inserted by the hook's sync)
              const { data: newNc } = await supabase
                .from('preventive_checklist_item_nonconformities')
                .select('id')
                .eq('exec_item_id', itemId)
                .eq('template_nonconformity_id', nonconformityId)
                .maybeSingle();

              if (newNc) {
                const { data: ncParts } = await (supabase as any)
                  .from('checklist_nonconformity_parts')
                  .select(`id, part_id, default_quantity, part:pecas(codigo, nome)`)
                  .eq('nonconformity_id', nonconformityId);
                
                if (ncParts && ncParts.length > 0) {
                  for (const np of ncParts) {
                    const { error: consumptionError } = await (supabase as any)
                      .from('preventive_part_consumption')
                      .upsert({
                        preventive_id: preventiveId,
                        exec_item_id: itemId,
                        exec_nonconformity_id: newNc.id,
                        part_id: np.part_id,
                        part_code_snapshot: np.part?.codigo || '',
                        part_name_snapshot: np.part?.nome || '',
                        quantity: np.default_quantity,
                        stock_source: null
                      }, {
                        onConflict: 'exec_nonconformity_id,part_id',
                        ignoreDuplicates: true
                      });
                    
                    if (consumptionError) {
                      console.error('Erro ao registrar consumo de peça:', consumptionError);
                    }
                  }
                }
              }
            }
          }
        }
      } finally {
        // Remove lock
        setProcessingNonconformities(prev => {
          const next = new Set(prev);
          next.delete(lockKey);
          return next;
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-checklist', preventiveId] });
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
      if (!offlineChecklist.isOnline) {
        refetchOffline();
      }
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      if (!offlineChecklist.isOnline) {
        setLastSavedAt(new Date());
        return;
      }
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
  if (loadingChecklist || (routeTemplateId && !existingChecklist && isChecklistOnline && (autoStartState === 'pending' || createChecklistMutation.isPending))) {
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

  // Offline and no cached checklist available
  if (!isChecklistOnline && !existingChecklist && !loadingChecklist) {
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
    items: block.items?.map((item: any) => {
      const baseSelectedActions = item.selected_actions?.map((a: any) => a.template_action_id) || [];
      const baseSelectedNcs = item.selected_nonconformities?.map((nc: any) => nc.template_nonconformity_id) || [];
      return {
        ...item,
        status: optimisticStatuses[item.id] ?? item.status,
        selectedActions: optimisticActionSelections[item.id] 
          ? [...optimisticActionSelections[item.id]] 
          : baseSelectedActions,
        selectedNonconformities: optimisticNcSelections[item.id] 
          ? [...optimisticNcSelections[item.id]] 
          : baseSelectedNcs,
        availableActions: templateActions?.[item.template_item_id] || [],
        availableNonconformities: templateNonconformities?.[item.template_item_id] || []
      };
    }).sort((a: ExecItem, b: ExecItem) => a.order_index - b.order_index) || []
  })).sort((a: ExecBlock, b: ExecBlock) => a.order_index - b.order_index) || [];

  const totalItems = blocks.reduce((acc, block) => acc + block.items.length, 0);
  const answeredItems = blocks.reduce(
    (acc, block) => acc + block.items.filter(item => item.status !== null).length, 
    0
  );
  const progress = totalItems > 0 ? (answeredItems / totalItems) * 100 : 0;
  const isCompleted = existingChecklist.status === 'concluido';
  const allAnswered = answeredItems === totalItems;

  // Check if any item with status N is missing required selections:
  // - Must have at least one non-conformity selected (if available)
  // - Must have at least one corrective action selected (if available)
  const hasIncompleteFailures = blocks.some(block => 
    block.items.some(item => {
      if (item.status !== 'N') return false;
      
      const missingNonconformity = item.availableNonconformities.length > 0 && item.selectedNonconformities.length === 0;
      const missingAction = item.availableActions.length > 0 && item.selectedActions.length === 0;
      
      return missingNonconformity || missingAction;
    })
  );

  // Prepare blocks for navigation
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
    if (!offlineChecklist.isOnline && offlineChecklist.pendingCount > 0) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <WifiOff className="h-3 w-3" />
          <span>{offlineChecklist.pendingCount} pendente{offlineChecklist.pendingCount > 1 ? 's' : ''}</span>
        </div>
      );
    }
    if (!offlineChecklist.isOnline) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </div>
      );
    }
    if (isSavingNow || offlineChecklist.syncStatus === "syncing") {
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Salvando...</span>
        </div>
      );
    }
    if (offlineChecklist.syncStatus === "pending" && offlineChecklist.pendingCount > 0) {
      return (
        <button 
          onClick={offlineChecklist.triggerSync}
          className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Sincronizar</span>
        </button>
      );
    }
    if (offlineChecklist.syncStatus === "error") {
      return (
        <button 
          onClick={offlineChecklist.triggerSync}
          className="flex items-center gap-1.5 text-destructive hover:text-destructive/80 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Erro</span>
        </button>
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
              {/* Title row */}
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
            {/* Progress controls - only when not completed */}
            {!isCompleted && (
              <div className="px-4 sm:px-6 pb-3 space-y-3">
            <div className="space-y-2 pt-1">
              {/* Sync status */}
              <div className="flex items-center justify-center text-xs">
                {getSyncStatusDisplay()}
              </div>

              {/* Progress bar and complete button */}
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
                  disabled={completeChecklistMutation.isPending || !isAllAnswered || !offlineChecklist.isOnline}
                  className="shrink-0"
                  size="default"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Concluir
                </Button>
              </div>

              {/* Warning messages */}
              {!offlineChecklist.isOnline && isAllAnswered && (
                <p className="text-xs text-amber-600 text-center">⚠️ Reconecte para concluir</p>
              )}
              {hasIncompleteFailures && isAllAnswered && offlineChecklist.isOnline && (
                <p className="text-xs text-amber-600 text-center">⚠️ Existem falhas sem tratativas</p>
              )}
              {!isAllAnswered && (
                <p className="text-xs text-muted-foreground text-center">Responda todos os itens para concluir</p>
              )}
            </div>
            
            {/* Block Navigation Chips - Hidden for now */}
            {/* {blocks.length > 1 && (
              <div className="w-full overflow-x-auto overscroll-x-contain">
                <ChecklistBlockNav 
                  blocks={navBlocks}
                  activeBlockId={activeBlockId}
                  onBlockClick={scrollToBlock}
                />
              </div>
            )} */}
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
                  
                  // Check if this failure needs treatment:
                  // - Missing non-conformity selection (if options available)
                  // - Missing corrective action selection (if options available)
                  const missingNonconformity = item.availableNonconformities.length > 0 && item.selectedNonconformities.length === 0;
                  const missingAction = item.availableActions.length > 0 && item.selectedActions.length === 0;
                  const needsTreatment = item.status === 'N' && hasFailureDetails && (missingNonconformity || missingAction);

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
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className="font-medium">{item.item_name_snapshot}</span>
                            {needsTreatment && !isCompleted && (
                              <Badge variant="destructive" className="shrink-0 text-xs animate-pulse">
                                Pendente
                              </Badge>
                            )}
                          </div>
                          {isCompleted && <StatusBadge status={item.status} />}
                        </div>
                        {!isCompleted && (
                          <ChecklistItemStatusButtons
                            value={item.status}
                            onChange={(status) => {
                              // Check if changing from N to S/NA with selections
                              const hasSelections = item.selectedNonconformities.length > 0 || item.selectedActions.length > 0;
                              if (item.status === 'N' && (status === 'S' || status === 'NA') && hasSelections) {
                                // Show confirmation dialog
                                setPendingStatusChange({
                                  itemId: item.id,
                                  newStatus: status,
                                  hasSelections: true
                                });
                              } else {
                                // Optimistic UI update — reflect immediately (before mutate)
                                setOptimisticStatuses(prev => ({ ...prev, [item.id]: status }));
                                // Auto-expand when marking as failure
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

                      {/* Collapsible section for failures */}
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
                            {/* Loading state when template data not yet available */}
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
                                          // Optimistic update
                                          setOptimisticNcSelections(prev => {
                                            const current = new Set(prev[item.id] || new Set(item.selectedNonconformities));
                                            if (isSelected) current.delete(nc.id); else current.add(nc.id);
                                            return { ...prev, [item.id]: current };
                                          });
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
                                          // Optimistic update
                                          setOptimisticActionSelections(prev => {
                                            const current = new Set(prev[item.id] || new Set(item.selectedActions));
                                            if (isSelected) current.delete(action.id); else current.add(action.id);
                                            return { ...prev, [item.id]: current };
                                          });
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

      {/* Confirmation dialog for changing status from N to S/NA */}
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
