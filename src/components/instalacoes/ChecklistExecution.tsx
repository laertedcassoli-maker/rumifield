import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, Loader2, Wrench, WifiOff, Cloud, CloudOff, ChevronDown, ChevronUp, CheckCircle2, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import ChecklistItemStatusButtons from "@/components/preventivas/ChecklistItemStatusButtons";
import SelectableOptionCard from "@/components/preventivas/SelectableOptionCard";
import ChecklistBlockNav from "@/components/preventivas/ChecklistBlockNav";
import ChecklistItemNotes from "@/components/preventivas/ChecklistItemNotes";
import { useCanEditCompletedChecklist } from "@/hooks/useCanEditCompletedChecklist";
import { useOfflineInstallationChecklist } from "@/hooks/useOfflineInstallationChecklist";
import { offlineInstallationDb } from "@/lib/offline-installation-db";
import { offlineChecklistDb } from "@/lib/offline-checklist-db";

interface InstallationChecklistExecutionProps {
  stageId: string;
  /** Template pré-definido na etapa — dispara o início automático do checklist */
  stageTemplateId?: string | null;
  onStatusChange?: (status: 'not_started' | 'in_progress' | 'completed') => void;
  forceReadOnly?: boolean;
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

export default function InstallationChecklistExecution({ stageId, stageTemplateId, onStatusChange, forceReadOnly = false }: InstallationChecklistExecutionProps) {
  const canEditCompleted = useCanEditCompletedChecklist();
  const queryClient = useQueryClient();
  const {
    isOnline,
    pendingCount,
    lastSyncTime,
    debouncedSync,
    triggerSync,
    updatePendingCount,
  } = useOfflineInstallationChecklist();

  const [isSelectTemplateOpen, setIsSelectTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isConfirmCompleteOpen, setIsConfirmCompleteOpen] = useState(false);
  const autoStartAttempted = useRef(false);
  const [autoStartState, setAutoStartState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [autoStartError, setAutoStartError] = useState<string | null>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isBlockExpanded, setIsBlockExpanded] = useState(true);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    itemId: string;
    newStatus: 'S' | 'N' | 'NA';
  } | null>(null);

  const processingNonconformitiesRef = useRef<Set<string>>(new Set());
  const processingActionsRef = useRef<Set<string>>(new Set());
  const [processingNonconformities, setProcessingNonconformities] = useState<Set<string>>(new Set());
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

  const queryKey = ['installation-checklist', stageId];

  // Load checklist: online-first with offline cache fallback (write-local-first engine)
  const { data: existingChecklist, isLoading: loadingChecklist } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('installation_checklists')
          .select(`
            *,
            template:checklist_templates(name),
            blocks:installation_checklist_blocks(
              id,
              block_name_snapshot,
              order_index,
              items:installation_checklist_items(
                id,
                item_name_snapshot,
                order_index,
                status,
                notes,
                answered_at,
                template_item_id,
                selected_actions:installation_checklist_item_actions(
                  id,
                  template_action_id,
                  action_label_snapshot
                ),
                selected_nonconformities:installation_checklist_item_nonconformities(
                  id,
                  template_nonconformity_id,
                  nonconformity_label_snapshot
                )
              )
            )
          `)
          .eq('installation_stage_id', stageId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // Refresh local cache for offline use
          await offlineInstallationDb.cacheFullChecklist(data);
          return data;
        }

        // No checklist on server — keep any cached one (shouldn't happen, but safe)
        return await offlineInstallationDb.getCachedChecklist(stageId);
      } catch (err) {
        console.warn('[InstallationChecklist] Online fetch failed, using offline cache:', err);
        const cached = await offlineInstallationDb.getCachedChecklist(stageId);
        if (cached) return cached;
        throw err;
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Available templates (only when there is no checklist yet)
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
    enabled: (!existingChecklist && !stageTemplateId) || isSelectTemplateOpen
  });

  const templateItemIds = existingChecklist?.blocks?.flatMap((block: any) =>
    block.items?.filter((item: any) => item.template_item_id).map((item: any) => item.template_item_id) || []
  ) || [];

  // Corrective actions for template items — online with offline cache fallback
  const { data: templateActions } = useQuery<Record<string, any[]>>({
    queryKey: ['template-corrective-actions', existingChecklist?.id],
    queryFn: async () => {
      if (!existingChecklist || templateItemIds.length === 0) return {};

      try {
        const { data, error } = await supabase
          .from('checklist_item_corrective_actions')
          .select('*')
          .in('item_id', templateItemIds)
          .eq('active', true)
          .order('order_index');

        if (error) throw error;

        await offlineChecklistDb.cacheTemplateActions(data || []);

        const grouped: Record<string, typeof data> = {};
        data?.forEach(action => {
          if (!grouped[action.item_id]) grouped[action.item_id] = [];
          grouped[action.item_id].push(action);
        });
        return grouped;
      } catch (err) {
        console.warn('[InstallationChecklist] Template actions offline fallback:', err);
        return offlineChecklistDb.getCachedTemplateActions(templateItemIds);
      }
    },
    enabled: !!existingChecklist && templateItemIds.length > 0,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Nonconformities for template items — online with offline cache fallback
  const { data: templateNonconformities } = useQuery<Record<string, any[]>>({
    queryKey: ['template-nonconformities', existingChecklist?.id],
    queryFn: async () => {
      if (!existingChecklist || templateItemIds.length === 0) return {};

      try {
        const { data, error } = await supabase
          .from('checklist_item_nonconformities')
          .select('*')
          .in('item_id', templateItemIds)
          .eq('active', true)
          .order('order_index');

        if (error) throw error;

        await offlineChecklistDb.cacheTemplateNonconformities(data || []);

        const grouped: Record<string, typeof data> = {};
        data?.forEach(nc => {
          if (!grouped[nc.item_id]) grouped[nc.item_id] = [];
          grouped[nc.item_id].push(nc);
        });
        return grouped;
      } catch (err) {
        console.warn('[InstallationChecklist] Template nonconformities offline fallback:', err);
        return offlineChecklistDb.getCachedTemplateNonconformities(templateItemIds);
      }
    },
    enabled: !!existingChecklist && templateItemIds.length > 0,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Parts coverage — online with offline fallback
  const { data: coveredExecItemIds } = useQuery<Set<string>>({
    queryKey: ['installation-part-consumption-coverage', stageId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('installation_part_consumption')
          .select('exec_item_id')
          .eq('installation_stage_id', stageId)
          .not('exec_item_id', 'is', null);

        if (error) throw error;
        return new Set((data || []).map((r: any) => r.exec_item_id));
      } catch (err) {
        const local = await offlineInstallationDb.getPartConsumptionsByStageId(stageId);
        return new Set(local.filter(p => p.exec_item_id).map(p => p.exec_item_id as string));
      }
    },
    enabled: !!existingChecklist,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  // Create checklist from template (requires online — snapshot copy)
  const createChecklistMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!navigator.onLine) throw new Error('Sem conexão. Conecte-se à internet para iniciar o checklist.');

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

      const { data: checklist, error: checklistError } = await (supabase as any)
        .from('installation_checklists')
        .insert({
          installation_stage_id: stageId,
          template_id: templateId
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      for (const block of (template as any).blocks || []) {
        const { data: execBlock, error: blockError } = await (supabase as any)
          .from('installation_checklist_blocks')
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
          const { error: itemsError } = await (supabase as any)
            .from('installation_checklist_items')
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

      // Mark stage as in progress (best-effort)
      await (supabase as any)
        .from('installation_stages')
        .update({ status: 'em_andamento' })
        .eq('id', stageId);

      return checklist;
    },
    onSuccess: () => {
      track('installation_checklist_started', { stage_id: stageId }, { entity: 'installation_checklist' });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
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
    if (!stageTemplateId) return;
    setAutoStartState('pending');
    setAutoStartError(null);
    createChecklistMutation.mutate(stageTemplateId);
  };

  const scrollToBlock = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
    const element = blockRefs.current[blockId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Auto-start when a template is set on the stage and no checklist exists
  useEffect(() => {
    if (!existingChecklist && stageTemplateId && !loadingChecklist && !autoStartAttempted.current && !createChecklistMutation.isPending && isOnline) {
      autoStartAttempted.current = true;
      setAutoStartState('pending');
      setAutoStartError(null);
      createChecklistMutation.mutate(stageTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingChecklist, stageTemplateId, loadingChecklist, createChecklistMutation.isPending, isOnline]);

  useEffect(() => {
    if (existingChecklist?.blocks && existingChecklist.blocks.length > 0 && !activeBlockId) {
      setActiveBlockId(existingChecklist.blocks[0].id);
    }
  }, [existingChecklist?.blocks, activeBlockId]);

  // Auto-expand failed items without treatment
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

  // Optimistic cache update helper
  const patchChecklistCache = useCallback((itemId: string, patch: (item: any) => any) => {
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        blocks: old.blocks?.map((block: any) => ({
          ...block,
          items: block.items?.map((item: any) => (item.id === itemId ? patch(item) : item))
        }))
      };
    });
  }, [queryClient, queryKey]);

  // Update item status/notes — write-local-first, sync in background
  const updateItem = useCallback(async (
    itemId: string,
    updates: { status?: 'S' | 'N' | 'NA' | null; notes?: string }
  ) => {
    const answeredAt = new Date().toISOString();

    await offlineInstallationDb.updateItemLocally(itemId, { ...updates, answered_at: answeredAt });

    // Status changed away from 'N' → clear selections + automatic parts locally
    if (updates.status && updates.status !== 'N') {
      await offlineInstallationDb.clearItemSelectionsLocally(itemId);
      await offlineInstallationDb.deletePartConsumptionByItemId(itemId);
      patchChecklistCache(itemId, (item: any) => ({
        ...item,
        status: updates.status,
        answered_at: answeredAt,
        selected_actions: [],
        selected_nonconformities: []
      }));
      queryClient.setQueryData(['installation-part-consumption-coverage', stageId], (old: Set<string> | undefined) => {
        if (!old) return old;
        const next = new Set(old);
        next.delete(itemId);
        return next;
      });
    } else {
      patchChecklistCache(itemId, (item: any) => ({
        ...item,
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        answered_at: answeredAt,
      }));
    }

    await updatePendingCount();
    debouncedSync();
  }, [patchChecklistCache, queryClient, stageId, updatePendingCount, debouncedSync]);

  // NC parts (auto-consumption mapping) — online with offline cache fallback
  const getNcParts = useCallback(async (templateNcId: string) => {
    try {
      const { data, error } = await supabase
        .from('checklist_nonconformity_parts')
        .select('id, nonconformity_id, part_id, default_quantity, pecas:part_id(codigo, nome)')
        .eq('nonconformity_id', templateNcId);

      if (error) throw error;

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        nonconformity_id: row.nonconformity_id,
        part_id: row.part_id,
        default_quantity: row.default_quantity,
        part_codigo: row.pecas?.codigo || '',
        part_nome: row.pecas?.nome || '',
      }));

      await offlineChecklistDb.cacheNonconformityParts(mapped);
      return mapped;
    } catch {
      const local = await offlineChecklistDb.getNonconformityParts(templateNcId);
      return local.map(p => ({
        id: p.id,
        nonconformity_id: p.nonconformity_id,
        part_id: p.part_id,
        default_quantity: p.default_quantity,
        part_codigo: p.part_codigo,
        part_nome: p.part_nome,
      }));
    }
  }, []);

  const itemHasTrocaAction = useCallback((itemId: string): boolean => {
    const checklist = queryClient.getQueryData(queryKey) as any;
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
  }, [queryClient, queryKey]);

  // Create part consumption for all selected NCs of an item — local-first
  const createPartConsumptionForItemNCs = useCallback(async (itemId: string) => {
    const checklist = queryClient.getQueryData(queryKey) as any;
    let selectedNCs: any[] = [];
    for (const block of checklist?.blocks || []) {
      for (const item of block.items || []) {
        if (item.id === itemId) selectedNCs = item.selected_nonconformities || [];
      }
    }
    if (selectedNCs.length === 0) return;

    for (const nc of selectedNCs) {
      if (!nc.template_nonconformity_id) continue;
      const ncParts = await getNcParts(nc.template_nonconformity_id);
      for (const np of ncParts) {
        await offlineInstallationDb.addPartConsumptionLocally({
          id: crypto.randomUUID(),
          installation_stage_id: stageId,
          exec_item_id: itemId,
          exec_nonconformity_id: nc.id,
          part_id: np.part_id,
          part_code_snapshot: np.part_codigo,
          part_name_snapshot: np.part_nome,
          quantity: np.default_quantity,
          stock_source: null,
          is_manual: false,
        });
      }
    }

    if (selectedNCs.length > 0) {
      queryClient.setQueryData(['installation-part-consumption-coverage', stageId], (old: Set<string> | undefined) => {
        const next = new Set(old ?? []);
        next.add(itemId);
        return next;
      });
    }
  }, [queryClient, queryKey, stageId, getNcParts]);

  const removePartConsumptionForItemNCs = useCallback(async (itemId: string) => {
    await offlineInstallationDb.deletePartConsumptionByItemId(itemId);
    queryClient.setQueryData(['installation-part-consumption-coverage', stageId], (old: Set<string> | undefined) => {
      if (!old) return old;
      const next = new Set(old);
      next.delete(itemId);
      return next;
    });
  }, [queryClient, stageId]);

  // Toggle corrective action — local-first
  const toggleAction = useCallback(async (itemId: string, actionId: string, actionLabel: string, isSelected: boolean) => {
    const lockKey = `${itemId}-${actionId}`;
    if (processingActionsRef.current.has(lockKey)) return;

    processingActionsRef.current.add(lockKey);
    setProcessingActions(new Set(processingActionsRef.current));

    try {
      if (isSelected) {
        await offlineInstallationDb.removeActionLocally(itemId, actionId);
        patchChecklistCache(itemId, (item: any) => ({
          ...item,
          selected_actions: (item.selected_actions || []).filter((a: any) => a.template_action_id !== actionId)
        }));

        const isTrocaAction = actionLabel.toLowerCase().includes('troca');
        if (isTrocaAction) {
          const stillHasTroca = itemHasTrocaAction(itemId);
          if (!stillHasTroca) {
            await removePartConsumptionForItemNCs(itemId);
          }
        }
      } else {
        await offlineInstallationDb.addActionLocally({
          id: crypto.randomUUID(),
          exec_item_id: itemId,
          template_action_id: actionId,
          action_label_snapshot: actionLabel,
          selected_at: new Date().toISOString()
        });
        patchChecklistCache(itemId, (item: any) => ({
          ...item,
          selected_actions: [
            ...(item.selected_actions || []),
            { id: crypto.randomUUID(), template_action_id: actionId, action_label_snapshot: actionLabel }
          ]
        }));

        const isTrocaAction = actionLabel.toLowerCase().includes('troca');
        if (isTrocaAction) {
          await createPartConsumptionForItemNCs(itemId);
        }
      }

      await updatePendingCount();
      debouncedSync();
    } finally {
      processingActionsRef.current.delete(lockKey);
      setProcessingActions(new Set(processingActionsRef.current));
    }
  }, [patchChecklistCache, itemHasTrocaAction, removePartConsumptionForItemNCs, createPartConsumptionForItemNCs, updatePendingCount, debouncedSync]);

  // Toggle nonconformity — local-first
  const toggleNonconformity = useCallback(async (itemId: string, nonconformityId: string, nonconformityLabel: string, isSelected: boolean) => {
    const lockKey = `${itemId}-${nonconformityId}`;
    if (processingNonconformitiesRef.current.has(lockKey)) return;

    processingNonconformitiesRef.current.add(lockKey);
    setProcessingNonconformities(new Set(processingNonconformitiesRef.current));

    try {
      if (isSelected) {
        const checklist = queryClient.getQueryData(queryKey) as any;
        let execNcId: string | null = null;
        for (const block of checklist?.blocks || []) {
          for (const item of block.items || []) {
            if (item.id === itemId) {
              const found = (item.selected_nonconformities || []).find((nc: any) => nc.template_nonconformity_id === nonconformityId);
              execNcId = found?.id ?? null;
            }
          }
        }

        await offlineInstallationDb.removeNonconformityLocally(itemId, nonconformityId);
        if (execNcId) {
          await offlineInstallationDb.deletePartConsumptionByNcId(execNcId);
        }
        patchChecklistCache(itemId, (item: any) => ({
          ...item,
          selected_nonconformities: (item.selected_nonconformities || []).filter((nc: any) => nc.template_nonconformity_id !== nonconformityId)
        }));
      } else {
        const execNcId = crypto.randomUUID();
        await offlineInstallationDb.addNonconformityLocally({
          id: execNcId,
          exec_item_id: itemId,
          template_nonconformity_id: nonconformityId,
          nonconformity_label_snapshot: nonconformityLabel,
          selected_at: new Date().toISOString()
        });
        patchChecklistCache(itemId, (item: any) => ({
          ...item,
          selected_nonconformities: [
            ...(item.selected_nonconformities || []),
            { id: execNcId, template_nonconformity_id: nonconformityId, nonconformity_label_snapshot: nonconformityLabel }
          ]
        }));

        // Auto part consumption when a "Troca" action is active
        if (itemHasTrocaAction(itemId)) {
          const ncParts = await getNcParts(nonconformityId);
          for (const np of ncParts) {
            await offlineInstallationDb.addPartConsumptionLocally({
              id: crypto.randomUUID(),
              installation_stage_id: stageId,
              exec_item_id: itemId,
              exec_nonconformity_id: execNcId,
              part_id: np.part_id,
              part_code_snapshot: np.part_codigo,
              part_name_snapshot: np.part_nome,
              quantity: np.default_quantity,
              stock_source: null,
              is_manual: false,
            });
          }
          if (ncParts.length > 0) {
            queryClient.setQueryData(['installation-part-consumption-coverage', stageId], (old: Set<string> | undefined) => {
              const next = new Set(old ?? []);
              next.add(itemId);
              return next;
            });
          }
        }
      }

      await updatePendingCount();
      debouncedSync();
    } finally {
      processingNonconformitiesRef.current.delete(lockKey);
      setProcessingNonconformities(new Set(processingNonconformitiesRef.current));
    }
  }, [queryClient, queryKey, patchChecklistCache, itemHasTrocaAction, getNcParts, stageId, updatePendingCount, debouncedSync]);

  // Complete checklist — requires online and zero pending syncs
  // Stage type — Pré Instalação goes to approval instead of straight to "concluido"
  const { data: stageInfo } = useQuery<{ stage: string } | null>({
    queryKey: ['installation-stage-type', stageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .select('stage')
        .eq('id', stageId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 300_000,
  });
  const isPreInstalacao = stageInfo?.stage === 'pre_instalacao';

  const completeChecklistMutation = useMutation({
    mutationFn: async () => {
      if (!existingChecklist) throw new Error('Checklist não encontrado');
      if (!navigator.onLine) throw new Error('Sem conexão. Reconecte para concluir.');

      // Flush pending changes first
      await triggerSync();
      const stillPending = await offlineInstallationDb.getPendingCount();
      if (stillPending > 0) {
        throw new Error('Existem alterações ainda não sincronizadas. Aguarde a sincronização e tente novamente.');
      }

      const { error } = await (supabase as any)
        .from('installation_checklists')
        .update({
          status: 'concluido',
          completed_at: new Date().toISOString()
        })
        .eq('id', existingChecklist.id);

      if (error) throw error;

      // Stage -> concluido
      const { data: stageRow } = await (supabase as any)
        .from('installation_stages')
        .update({ status: 'concluido' })
        .eq('id', stageId)
        .select('installation_id')
        .single();

      // If every stage of the installation is done, conclude the installation too
      if (stageRow?.installation_id) {
        const { data: siblings } = await (supabase as any)
          .from('installation_stages')
          .select('status')
          .eq('installation_id', stageRow.installation_id);

        if (siblings && siblings.length > 0 && siblings.every((s: any) => s.status === 'concluido')) {
          await (supabase as any)
            .from('installations')
            .update({ status: 'concluido' })
            .eq('id', stageRow.installation_id);
        }
      }
    },
    onSuccess: () => {
      track('installation_checklist_completed', {
        stage_id: stageId,
        checklist_id: existingChecklist?.id ?? null,
      }, { entity: 'installation_checklist', entity_id: existingChecklist?.id ?? stageId });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      queryClient.invalidateQueries({ queryKey: ['installation-stage', stageId] });
      toast.success('Checklist concluído!');
      setIsConfirmCompleteOpen(false);
      onStatusChange?.('completed');
    },
    onError: (error) => {
      toast.error('Erro ao concluir: ' + error.message);
    }
  });

  // ---- Render states ----

  if (loadingChecklist || (stageTemplateId && !existingChecklist && isOnline && (autoStartState === 'pending' || createChecklistMutation.isPending))) {
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

  if (!isOnline && !existingChecklist && !loadingChecklist) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Checklist não disponível offline. Conecte-se à internet para iniciar o checklist desta etapa.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stageTemplateId && !existingChecklist && autoStartAttempted.current && autoStartState === 'failed') {
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

  if (!existingChecklist) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5" />
              Checklist da Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Nenhum checklist foi iniciado para esta etapa.
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
                Escolha o template de checklist para esta etapa.
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

  // ---- Progress & validation ----
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
  const isReadOnly = forceReadOnly || (isCompleted && !canEditCompleted);
  const isAllAnswered = answeredItems === totalItems && totalItems > 0;

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

  const handleCompleteClick = () => {
    if (!navigator.onLine) {
      toast.error('Sem conexão. Reconecte para concluir o checklist.');
      return;
    }
    if (pendingCount > 0) {
      toast.error('Existem alterações pendentes de sincronização. Aguarde e tente novamente.');
      triggerSync();
      return;
    }
    if (!isAllAnswered) {
      toast.error('Responda todos os itens para concluir o checklist.');
      return;
    }
    setIsConfirmCompleteOpen(true);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const getSyncStatusDisplay = () => {
    if (isSaving) {
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Salvando...</span>
        </div>
      );
    }
    if (!isOnline) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <CloudOff className="h-3 w-3" />
          <span>Offline — salvo no aparelho{pendingCount > 0 ? ` (${pendingCount} pendente${pendingCount > 1 ? 's' : ''})` : ''}</span>
        </div>
      );
    }
    if (pendingCount > 0) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <Cloud className="h-3 w-3" />
          <span>Sincronizando {pendingCount} alteraç{pendingCount > 1 ? 'ões' : 'ão'}...</span>
        </div>
      );
    }
    if (lastSyncTime) {
      return (
        <div className="flex items-center gap-1.5 text-success">
          <Cloud className="h-3 w-3" />
          <span>Sincronizado {formatTime(lastSyncTime)}</span>
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
                  {existingChecklist.template?.name && (
                    <span className="text-sm font-normal text-muted-foreground truncate">
                      {existingChecklist.template.name}
                    </span>
                  )}
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
            {!isReadOnly && (
              <div className="px-4 sm:px-6 pb-3 space-y-3">
                <div className="space-y-2 pt-1">
                  {isCompleted && canEditCompleted && (
                    <div className="flex items-start gap-2 text-xs p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Modo edição:</strong> este checklist já foi concluído. Alterações serão salvas mesmo assim.
                      </span>
                    </div>
                  )}
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
                    {!isCompleted && (
                      <Button
                        onClick={handleCompleteClick}
                        disabled={completeChecklistMutation.isPending}
                        className="shrink-0"
                        size="default"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Concluir
                      </Button>
                    )}
                  </div>

                  {!isCompleted && hasIncompleteFailures && isAllAnswered && (
                    <p className="text-xs text-amber-600 text-center">⚠️ Existem falhas sem tratativas</p>
                  )}
                  {!isCompleted && !isAllAnswered && (
                    <p className="text-xs text-muted-foreground text-center">Responda todos os itens para concluir</p>
                  )}
                </div>
              </div>
            )}

            {navBlocks.length > 1 && (
              <div className="px-4 sm:px-6 pb-3">
                <ChecklistBlockNav
                  blocks={navBlocks}
                  activeBlockId={activeBlockId}
                  onBlockClick={scrollToBlock}
                />
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
                                {needsTreatment && !isReadOnly && (
                                  <Badge variant="destructive" className="shrink-0 text-xs animate-pulse">
                                    Pendente
                                  </Badge>
                                )}
                                {needsPart && !isReadOnly && (
                                  <Badge variant="outline" className="shrink-0 text-xs border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                                    <Package className="h-3 w-3 mr-1" />
                                    Peça pendente
                                  </Badge>
                                )}
                              </div>
                              {isReadOnly && <StatusBadge status={item.status} />}
                            </div>
                            {!isReadOnly && (
                              <ChecklistItemStatusButtons
                                value={item.status}
                                onChange={(status) => {
                                  const hasSelections = item.selectedNonconformities.length > 0 || item.selectedActions.length > 0;
                                  if (item.status === 'N' && (status === 'S' || status === 'NA') && hasSelections) {
                                    setPendingStatusChange({ itemId: item.id, newStatus: status });
                                  } else {
                                    if (status === 'N') {
                                      setExpandedItems(prev => new Set([...prev, item.id]));
                                    }
                                    updateItem(item.id, { status });
                                  }
                                }}
                              />
                            )}
                          </div>

                          {hasFailureDetails && !isReadOnly && (
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
                                            disabled={isReadOnly}
                                            loading={isProcessing}
                                            variant="danger"
                                            onClick={() => {
                                              toggleNonconformity(item.id, nc.id, nc.nonconformity_label, isSelected);
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

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
                                            disabled={isReadOnly}
                                            loading={isProcessing}
                                            variant="success"
                                            onClick={() => {
                                              toggleAction(item.id, action.id, action.action_label, isSelected);
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

                          {isReadOnly && item.status === 'N' && item.selectedNonconformities.length > 0 && (
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

                          {isReadOnly && item.status === 'N' && item.selectedActions.length > 0 && (
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

                          {!isReadOnly ? (
                            <ChecklistItemNotes
                              itemId={item.id}
                              initialValue={item.notes}
                              onSave={async (itemId, notes) => {
                                setIsSaving(true);
                                await updateItem(itemId, { notes });
                                setIsSaving(false);
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
              Tem certeza que deseja concluir o checklist desta etapa?
              Após a conclusão, a etapa será marcada como concluída.
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
                  updateItem(pendingStatusChange.itemId, { status: pendingStatusChange.newStatus });
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
