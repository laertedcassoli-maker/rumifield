import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { offlineChecklistDb } from '@/lib/offline-checklist-db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  LogOut,
  AlertTriangle,
  Play,
  Wrench,
  Share2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import ChecklistExecution from '@/components/preventivas/ChecklistExecution';
import VisitMediaUpload from '@/components/preventivas/VisitMediaUpload';
import ConsumedPartsBlock from '@/components/preventivas/ConsumedPartsBlock';
import ObservationsBlock from '@/components/preventivas/ObservationsBlock';
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

interface ValidationResult {
  canProceed: boolean;
  blockingErrors: string[];
  warnings: string[];
}

export default function ExecucaoVisitaCorretiva() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getLocation } = useGeolocation();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<'resolvido' | 'parcial' | 'aguardando_peca' | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [completedResult, setCompletedResult] = useState<'resolvido' | 'parcial' | 'aguardando_peca' | null>(null);

  // Bug #4: Reactive online state
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

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch visit details
  const { data: visit, isLoading, refetch } = useQuery({
    queryKey: ['corrective-visit-execution', visitId],
    queryFn: async () => {
      const { data: visitData, error } = await supabase
        .from('ticket_visits')
        .select(`
          id,
          visit_code,
          ticket_id,
          client_id,
          field_technician_user_id,
          status,
          planned_start_date,
          checklist_template_id,
          checkin_at,
          checkin_lat,
          checkin_lon,
          checkout_at,
          internal_notes,
          public_notes,
          result,
          visit_summary
        `)
        .eq('id', visitId)
        .maybeSingle();

      if (error) throw error;
      if (!visitData) return null;

      // Fetch ticket details
      const { data: ticket } = await supabase
        .from('technical_tickets')
        .select('id, ticket_code, title')
        .eq('id', visitData.ticket_id)
        .maybeSingle();

      // Fetch client details
      const { data: client } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado')
        .eq('id', visitData.client_id)
        .maybeSingle();

      // Check for existing preventive_maintenance record linked to this visit
      let preventiveId: string | null = null;

      const { data: existingPm } = await supabase
        .from('preventive_maintenance')
        .select('id, internal_notes, public_notes, public_token')
        .eq('client_id', visitData.client_id)
        .ilike('notes', `%CORR-VISIT-${visitData.id}%`)
        .maybeSingle();

      let internalNotes: string | null = visitData.internal_notes;
      let publicNotes: string | null = visitData.public_notes;
      let publicToken: string | null = null;

      if (existingPm) {
        preventiveId = existingPm.id;
        internalNotes = existingPm.internal_notes || visitData.internal_notes;
        publicNotes = existingPm.public_notes || visitData.public_notes;
        publicToken = existingPm.public_token;
      }

      // Check checklist status
      if (preventiveId) {
        const { data: checklist } = await supabase
          .from('preventive_checklists')
          .select('status')
          .eq('preventive_id', preventiveId)
          .maybeSingle();
        
        if (checklist) {
          setChecklistStatus(checklist.status === 'concluido' ? 'completed' : 'in_progress');
        }
      }

      return {
        ...visitData,
        ticket,
        client,
        preventiveId,
        internalNotes,
        publicNotes,
        publicToken,
      };
    },
    enabled: !!visitId,
  });

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async () => {
      // Bug #4: Check connectivity before attempting
      if (!navigator.onLine) {
        throw new Error('Sem conexão com a internet. Conecte-se e tente novamente.');
      }

      setIsCheckingIn(true);
      let lat: number | null = null;
      let lon: number | null = null;

      try {
        const position = await getLocation();
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch {
        // Continue without geolocation
      }

      // Bug #3: Timeout + RLS verification
      const checkinPromise = supabase
        .from('ticket_visits')
        .update({
          checkin_at: new Date().toISOString(),
          checkin_lat: lat,
          checkin_lon: lon,
          status: 'em_execucao',
        })
        .eq('id', visitId)
        .select('id')
        .single();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: servidor demorou mais que 15s. Tente novamente.')), 15000)
      );

      const { data, error } = await Promise.race([checkinPromise, timeoutPromise]) as any;

      if (error) throw error;
      if (!data) {
        throw new Error('Check-in não foi salvo. Verifique sua conexão e tente novamente.');
      }

      // Create preventive_maintenance record for this corrective visit (needed for checklist)
      let preventiveId: string | null = null;
      try {
        const { data: existingPm } = await supabase
          .from('preventive_maintenance')
          .select('id')
          .eq('client_id', visit?.client_id)
          .ilike('notes', `%CORR-VISIT-${visitId}%`)
          .maybeSingle();

        if (existingPm) {
          preventiveId = existingPm.id;
        } else {
          const { data: newPm } = await supabase
            .from('preventive_maintenance')
            .insert([{
              client_id: visit?.client_id,
              scheduled_date: visit?.planned_start_date || new Date().toISOString().split('T')[0],
              status: 'planejada' as const,
              technician_user_id: visit?.field_technician_user_id,
              notes: `Visita Corretiva CORR-VISIT-${visitId} - ${visit?.ticket?.ticket_code || 'Chamado'}`,
            }])
            .select('id')
            .single();
          if (newPm) preventiveId = newPm.id;
        }
      } catch (pmErr) {
        console.error('[Corretiva] Erro ao criar preventive_maintenance no check-in:', pmErr);
      }

      // Bug #3: Timeline is non-critical — don't block checkin
      try {
        await supabase.from('ticket_timeline').insert({
          ticket_id: visit?.ticket_id,
          user_id: user!.id,
          event_type: 'visit_checkin',
          event_description: `Check-in realizado na visita ${visit?.visit_code}`,
        });
      } catch (timelineErr) {
        console.error('[Corretiva] Timeline de checkin não criada:', timelineErr);
      }

      return { lat, lon, preventiveId };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['corrective-visit-execution', visitId],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            checkin_at: new Date().toISOString(),
            status: 'em_execucao',
            preventiveId: result.preventiveId || old.preventiveId,
          };
        }
      );
      // Mark stale but don't refetch immediately (avoid replica lag overwrite)
      queryClient.invalidateQueries({
        queryKey: ['corrective-visit-execution', visitId],
        refetchType: 'none',
      });
      queryClient.invalidateQueries({
        queryKey: ['my-corrective-visits'],
        refetchType: 'none',
      });
      toast({
        title: 'Check-in realizado!',
        description: 'Você pode iniciar o atendimento.',
      });
      setIsCheckingIn(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao fazer check-in',
        description: error.message,
        variant: 'destructive',
      });
      setIsCheckingIn(false);
    },
  });

  // Complete visit mutation
  const completeMutation = useMutation({
    mutationFn: async (result: 'resolvido' | 'parcial' | 'aguardando_peca') => {
      if (!visit) throw new Error('Visita não encontrada');

      // Bug #4: Check connectivity
      if (!navigator.onLine) {
        throw new Error('Sem conexão com a internet. Conecte-se e tente novamente.');
      }

      // Bug #5: Check current state for idempotency
      const { data: currentVisit } = await supabase
        .from('ticket_visits')
        .select('status, checkout_at')
        .eq('id', visitId)
        .single();

      if (currentVisit?.status === 'finalizada' && currentVisit?.checkout_at) {
        // Already fully completed — return early
        return result;
      }

      let lat: number | null = null;
      let lon: number | null = null;

      try {
        const position = await getLocation();
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch {
        // Continue without geolocation
      }

      // CRITICAL: Update ticket_visits status to finalizada
      const { data: visitUpdateData, error: visitError } = await supabase
        .from('ticket_visits')
        .update({ 
          status: 'finalizada',
          checkout_at: new Date().toISOString(),
          checkout_lat: lat,
          checkout_lon: lon,
          result: result,
        })
        .eq('id', visitId)
        .select('id')
        .single();

      if (visitError) throw visitError;
      if (!visitUpdateData) throw new Error('Encerramento não foi salvo. Verifique permissões e tente novamente.');

      // NON-CRITICAL: Update corrective_maintenance
      if (visit.preventiveId) {
        try {
          const publicToken = crypto.randomUUID();
          await supabase
            .from('corrective_maintenance')
            .update({
              status: 'concluida',
              checkout_at: new Date().toISOString(),
              checkout_lat: lat,
              checkout_lon: lon,
              public_token: publicToken,
            })
            .eq('id', visit.preventiveId);
        } catch (cmError) {
          console.error('[Corretiva] Erro ao atualizar corrective_maintenance:', cmError);
        }
      }

      // NON-CRITICAL: Auto-create pedidos for consumed parts
      if (visit.preventiveId && user) {
        try {
          // Pedido for parts with stock_source = 'novo_pedido' (envio_fisico)
          const { data: novoPedidoParts } = await supabase
            .from('preventive_part_consumption')
            .select('part_id, part_name_snapshot, quantity')
            .eq('preventive_id', visit.preventiveId)
            .eq('stock_source', 'novo_pedido');

          if (novoPedidoParts && novoPedidoParts.length > 0) {
            // Check if pedido already exists for idempotency
            const { data: existingPedido } = await supabase
              .from('pedidos')
              .select('id')
              .eq('preventive_id', visit.preventiveId)
              .eq('origem', 'corretiva')
              .eq('tipo_envio', 'envio_fisico')
              .maybeSingle();

            if (!existingPedido) {
              const { data: pedido, error: pedidoError } = await supabase
                .from('pedidos')
                .insert({
                  cliente_id: visit.client_id,
                  solicitante_id: user.id,
                  preventive_id: visit.preventiveId,
                  observacoes: `Gerado automaticamente na visita corretiva ${visit.visit_code}`,
                  origem: 'corretiva',
                  tipo_envio: 'envio_fisico',
                  urgencia: 'normal',
                } as any)
                .select('id')
                .single();

              if (!pedidoError && pedido) {
                const grouped: Record<string, number> = {};
                for (const p of novoPedidoParts) {
                  grouped[p.part_id] = (grouped[p.part_id] || 0) + (p.quantity || 1);
                }
                const pedidoItens = Object.entries(grouped).map(([peca_id, quantidade]) => ({
                  pedido_id: pedido.id,
                  peca_id,
                  quantidade,
                }));
                await supabase.from('pedido_itens').insert(pedidoItens);

                await supabase.from('ticket_parts_requests').insert({
                  ticket_id: visit.ticket_id,
                  pedido_id: pedido.id,
                  visit_id: visit.id,
                });
              }
            }
          }
        } catch (pedidoErr) {
          console.error('[Corretiva] Erro ao criar pedido envio_fisico:', pedidoErr);
        }

        try {
          // Pedido for parts with stock_source = 'tecnico' (apenas_nf)
          const { data: tecnicoPartsForNF } = await supabase
            .from('preventive_part_consumption')
            .select('part_id, part_name_snapshot, quantity')
            .eq('preventive_id', visit.preventiveId)
            .eq('stock_source', 'tecnico');

          if (tecnicoPartsForNF && tecnicoPartsForNF.length > 0) {
            // Check if pedido already exists for idempotency
            const { data: existingPedidoNF } = await supabase
              .from('pedidos')
              .select('id')
              .eq('preventive_id', visit.preventiveId)
              .eq('origem', 'corretiva')
              .eq('tipo_envio', 'apenas_nf')
              .maybeSingle();

            if (!existingPedidoNF) {
              const { data: pedidoNF, error: pedidoNFError } = await supabase
                .from('pedidos')
                .insert({
                  cliente_id: visit.client_id,
                  solicitante_id: user.id,
                  preventive_id: visit.preventiveId,
                  observacoes: `Peças do estoque do técnico consumidas na corretiva ${visit.visit_code} — apenas para emissão de NF/faturamento`,
                  origem: 'corretiva',
                  tipo_envio: 'apenas_nf',
                  urgencia: 'normal',
                } as any)
                .select('id')
                .single();

              if (!pedidoNFError && pedidoNF) {
                const groupedNF: Record<string, number> = {};
                for (const p of tecnicoPartsForNF) {
                  groupedNF[p.part_id] = (groupedNF[p.part_id] || 0) + (p.quantity || 1);
                }
                const pedidoItensNF = Object.entries(groupedNF).map(([peca_id, quantidade]) => ({
                  pedido_id: pedidoNF.id,
                  peca_id,
                  quantidade,
                }));
                await supabase.from('pedido_itens').insert(pedidoItensNF);

                await supabase.from('ticket_parts_requests').insert({
                  ticket_id: visit.ticket_id,
                  pedido_id: pedidoNF.id,
                  visit_id: visit.id,
                });
              }
            }
          }
        } catch (pedidoNFErr) {
          console.error('[Corretiva] Erro ao criar pedido apenas_nf:', pedidoNFErr);
        }

        // NON-CRITICAL: Auto-create workshop_items
        try {
          const { data: tecnicoParts } = await supabase
            .from('preventive_part_consumption')
            .select('part_id, asset_unique_code')
            .eq('preventive_id', visit.preventiveId)
            .eq('stock_source', 'tecnico')
            .not('asset_unique_code', 'is', null);

          if (tecnicoParts && tecnicoParts.length > 0) {
            const partIds = [...new Set(tecnicoParts.map(tp => tp.part_id))];
            const { data: assetParts } = await supabase
              .from('pecas')
              .select('id, is_asset')
              .in('id', partIds);
            const assetSet = new Set((assetParts || []).filter((p: any) => p.is_asset).map((p: any) => p.id));

            for (const tp of tecnicoParts) {
              if (!tp.asset_unique_code?.trim()) continue;
              if (!assetSet.has(tp.part_id)) continue;
              const { data: existing } = await supabase
                .from('workshop_items')
                .select('id')
                .eq('unique_code', tp.asset_unique_code.trim())
                .maybeSingle();

              if (!existing) {
                await supabase.from('workshop_items').insert({
                  unique_code: tp.asset_unique_code.trim(),
                  omie_product_id: tp.part_id,
                  status: 'disponivel',
                });
              }
            }
          }
        } catch (workshopErr) {
          console.error('[Corretiva] Erro ao criar workshop_items:', workshopErr);
        }
      }

      // Build result label for timeline
      const resultLabels = {
        resolvido: 'Resolvido',
        parcial: 'Parcialmente resolvido',
        aguardando_peca: 'Aguardando peça'
      };

      // NON-CRITICAL: Add timeline entry
      try {
        await supabase.from('ticket_timeline').insert({
          ticket_id: visit.ticket_id,
          user_id: user!.id,
          event_type: 'visit_completed',
          event_description: `Visita ${visit.visit_code} concluída - ${resultLabels[result]}`,
        });
      } catch (timelineErr) {
        console.error('[Corretiva] Erro ao criar timeline de conclusão:', timelineErr);
      }

      // If result is "resolvido", close the ticket
      if (result === 'resolvido') {
        try {
          const { error: ticketError } = await supabase
            .from('technical_tickets')
            .update({ 
              status: 'resolvido',
              substatus: null,
              resolved_at: new Date().toISOString(),
            })
            .eq('id', visit.ticket_id);

          if (ticketError) {
            console.error('[Corretiva] Erro ao resolver chamado:', ticketError);
          }

          // Add timeline entry for ticket resolution
          await supabase.from('ticket_timeline').insert({
            ticket_id: visit.ticket_id,
            user_id: user!.id,
            event_type: 'status_change',
            event_description: 'Chamado encerrado - Problema resolvido na visita',
          });
        } catch (resolveErr) {
          console.error('[Corretiva] Erro ao resolver chamado/timeline:', resolveErr);
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['corrective-visit-execution', visitId] });
      queryClient.invalidateQueries({ queryKey: ['my-corrective-visits'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', visit?.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', visit?.ticket_id] });
      
      const messages = {
        resolvido: 'Visita encerrada e chamado resolvido!',
        parcial: 'Visita encerrada como parcialmente resolvida.',
        aguardando_peca: 'Visita encerrada - aguardando peça.'
      };
      
      toast({
        title: messages[result],
        description: result === 'resolvido' 
          ? 'O chamado foi marcado como resolvido.' 
          : 'O chamado permanece aberto para acompanhamento.',
      });
      
      setSelectedResult(null);
      setShowCompleteDialog(false);
      
      navigate('/preventivas/minhas-rotas');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao encerrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canAccess = isAdminOrCoordinator || visit?.field_technician_user_id === user?.id;
  const isVisitCompleted = visit?.status === 'finalizada' || !!completedResult;
  const hasCheckedIn = !!visit?.checkin_at;
  const canFinishVisit = checklistStatus === 'completed';

  // Validation function for encerrar
  const validateBeforeComplete = async (): Promise<ValidationResult> => {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    if (!visit?.preventiveId) {
      return { canProceed: false, blockingErrors: ['Registro de manutenção não encontrado'], warnings: [] };
    }

    // Check for parts without stock source
    const { data: partsWithoutSource } = await supabase
      .from('preventive_part_consumption')
      .select('id, part_name_snapshot')
      .eq('preventive_id', visit.preventiveId)
      .is('stock_source', null);

    if (partsWithoutSource && partsWithoutSource.length > 0) {
      blockingErrors.push(`${partsWithoutSource.length} peça(s) sem origem definida (Técnico/Fazenda)`);
    }

    // Check checklist items with "troca" action have at least 1 linked part
    try {
      const { data: activeChecklist } = await supabase
        .from('preventive_checklists')
        .select('id')
        .eq('preventive_id', visit.preventiveId)
        .in('status', ['em_andamento', 'concluido'])
        .limit(1)
        .maybeSingle();

      if (activeChecklist) {
        // Step 1: Get block IDs for this checklist
        const { data: blocks } = await supabase
          .from('preventive_checklist_blocks')
          .select('id')
          .eq('checklist_id', activeChecklist.id);

        const blockIds = (blocks || []).map(b => b.id);

        if (blockIds.length > 0) {
          // Step 2: Get failed items in those blocks
          const { data: failedItems } = await supabase
            .from('preventive_checklist_items')
            .select('id, item_name_snapshot')
            .eq('status', 'N')
            .in('exec_block_id', blockIds);

          if (failedItems && failedItems.length > 0) {
            const failedItemIds = failedItems.map(i => i.id);

            // Step 3: Get actions containing "troca"
            const { data: trocaActions } = await supabase
              .from('preventive_checklist_item_actions')
              .select('exec_item_id')
              .in('exec_item_id', failedItemIds)
              .ilike('action_label_snapshot', '%troca%');

            if (trocaActions && trocaActions.length > 0) {
              const itemIdsWithTroca = [...new Set(trocaActions.map(a => a.exec_item_id))];

              // Step 4: Check which items have linked parts (server + local Dexie)
              const { data: linkedParts } = await supabase
                .from('preventive_part_consumption')
                .select('exec_item_id')
                .eq('preventive_id', visit.preventiveId)
                .in('exec_item_id', itemIdsWithTroca);

              const itemIdsWithParts = new Set((linkedParts || []).map(p => p.exec_item_id));

              // Also check local Dexie for pending parts not yet synced
              const localParts = await offlineChecklistDb.partConsumptions
                .filter(pc => pc.preventive_id === visit.preventiveId
                  && pc.exec_item_id !== null
                  && itemIdsWithTroca.includes(pc.exec_item_id!)
                  && pc._operation !== 'delete')
                .toArray();
              localParts.forEach(lp => {
                if (lp.exec_item_id) itemIdsWithParts.add(lp.exec_item_id);
              });

              const itemsWithoutParts = itemIdsWithTroca.filter(id => !itemIdsWithParts.has(id));

              // If there are still unlinked troca items, check if manual parts cover them
              if (itemsWithoutParts.length > 0) {
                const { data: manualParts } = await supabase
                  .from('preventive_part_consumption')
                  .select('id')
                  .eq('preventive_id', visit.preventiveId)
                  .is('exec_item_id', null);

                const localManualParts = await offlineChecklistDb.partConsumptions
                  .filter(pc => pc.preventive_id === visit.preventiveId
                    && pc.exec_item_id === null
                    && pc._operation !== 'delete')
                  .toArray();

                const totalManualParts = (manualParts?.length || 0) + localManualParts.length;
                const stillMissing = itemsWithoutParts.length - totalManualParts;

                if (stillMissing > 0) {
                  blockingErrors.push(
                    'Existem itens no checklist com troca de peça que ainda não possuem peça vinculada. Adicione uma peça para cada item antes de finalizar a visita.'
                  );
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro na validação de peças vinculadas:', err);
      blockingErrors.push('Erro ao validar peças vinculadas ao checklist. Tente novamente.');
    }

    // Check for at least one media
    const { count: mediaCount } = await supabase
      .from('preventive_visit_media')
      .select('id', { count: 'exact', head: true })
      .eq('preventive_id', visit.preventiveId);

    if (!mediaCount || mediaCount === 0) {
      blockingErrors.push('Nenhuma foto/vídeo anexado');
    }

    // Check for empty observations (warning only)
    const { data: pmData } = await supabase
      .from('preventive_maintenance')
      .select('internal_notes, public_notes')
      .eq('id', visit.preventiveId)
      .maybeSingle();

    const hasInternalNotes = pmData?.internal_notes && pmData.internal_notes.trim().length > 0;
    const hasPublicNotes = pmData?.public_notes && pmData.public_notes.trim().length > 0;

    if (!hasInternalNotes) {
      warnings.push('Observação interna está vazia');
    }
    if (!hasPublicNotes) {
      warnings.push('Observação para relatório está vazia');
    }

    return {
      canProceed: blockingErrors.length === 0,
      blockingErrors,
      warnings,
    };
  };

  const handleEncerrarClick = async () => {
    const result = await validateBeforeComplete();
    setValidationResult(result);

    if (!result.canProceed) {
      toast({
        title: 'Não é possível encerrar',
        description: result.blockingErrors.join('. '),
        variant: 'destructive',
      });
      return;
    }

    if (result.warnings.length > 0) {
      setShowWarningDialog(true);
    } else {
      setShowResultDialog(true);
    }
  };

  const handleResultSelection = (result: 'resolvido' | 'parcial' | 'aguardando_peca') => {
    setSelectedResult(result);
    setShowResultDialog(false);
    setShowCompleteDialog(true);
  };

  const handleProceedAfterWarning = () => {
    setShowWarningDialog(false);
    setShowResultDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Visita não encontrada</h2>
        <Button asChild className="mt-4" size="sm">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Acesso negado</h2>
        <Button asChild className="mt-4" size="sm">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in w-full pb-24">
      {/* Minimal Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/preventivas/minhas-rotas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs">
              <Wrench className="h-3 w-3 mr-1" />
              CORR
            </Badge>
            {isVisitCompleted && (
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600 border-green-500/20"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Encerrada
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{visit.visit_code}</p>
              <h1 className="text-lg font-bold text-foreground">{visit.client?.nome}</h1>
              {visit.client?.fazenda && (
                <p className="text-sm text-muted-foreground -mt-0.5">{visit.client.fazenda}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {[visit.client?.cidade, visit.client?.estado].filter(Boolean).join(' - ')}
            </span>
          </div>

          {visit.ticket && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <Link 
                to={`/chamados/${visit.ticket_id}`}
                className="hover:text-primary transition-colors"
              >
                Chamado: {visit.ticket.ticket_code}
              </Link>
            </div>
          )}

          {visit.checkin_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Check-in: {format(parseISO(visit.checkin_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in Section */}
      {!hasCheckedIn && !isVisitCompleted && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Iniciar Atendimento</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Faça o check-in para registrar o início da visita
                </p>
              </div>
            </div>
            <Button 
              onClick={() => checkinMutation.mutate()}
              disabled={checkinMutation.isPending || isCheckingIn}
              size="lg"
              className="w-full"
            >
              {(checkinMutation.isPending || isCheckingIn) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Play className="h-4 w-4 mr-2" />
              Fazer Check-in
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content blocks after check-in */}
      {hasCheckedIn && (
        <>
          {/* Checklist Execution Block */}
          {visit.preventiveId ? (
            <ChecklistExecution 
              preventiveId={visit.preventiveId}
              routeTemplateId={visit.checklist_template_id || undefined}
              onStatusChange={(status) => {
                setChecklistStatus(status);
                if (status === 'completed') {
                  refetch();
                }
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Não foi possível criar o registro de manutenção
                </p>
              </CardContent>
            </Card>
          )}

          {/* Consumed Parts Block */}
          {visit.preventiveId && (
            <ConsumedPartsBlock 
              preventiveId={visit.preventiveId}
              isCompleted={isVisitCompleted}
            />
          )}

          {/* Observations Block */}
          {visit.preventiveId && (
            <ObservationsBlock 
              preventiveId={visit.preventiveId}
              initialInternalNotes={visit.internalNotes}
              initialPublicNotes={visit.publicNotes}
              isCompleted={isVisitCompleted}
            />
          )}

          {/* Media Upload Block */}
          {visit.preventiveId && (
            <VisitMediaUpload 
              preventiveId={visit.preventiveId}
              isCompleted={isVisitCompleted}
            />
          )}

          {/* Share Section - When Visit is Completed */}
          {isVisitCompleted && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Visita Encerrada</span>
                    <p className="text-sm text-muted-foreground">
                      {(completedResult || visit.result) === 'resolvido' && 'Problema resolvido - Chamado encerrado'}
                      {(completedResult || visit.result) === 'parcial' && 'Parcialmente resolvido - Requer nova visita'}
                      {(completedResult || visit.result) === 'aguardando_peca' && 'Aguardando peça - Chamado aberto'}
                    </p>
                  </div>
                </div>
                
                {visit.publicToken && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={async () => {
                        const origin = window.location.hostname.includes('lovableproject.com')
                          ? 'https://rumifield.lovable.app'
                          : window.location.origin;
                        const url = `${origin}/relatorio-corretivo/${visit.publicToken}`;
                        if (navigator.share) {
                          try { await navigator.share({ title: 'Relatório de Visita', url }); } catch {}
                        } else {
                          await navigator.clipboard.writeText(url);
                          toast({ title: 'Link copiado!' });
                        }
                      }}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Produtor
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={async () => {
                        const origin = window.location.hostname.includes('lovableproject.com')
                          ? 'https://rumifield.lovable.app'
                          : window.location.origin;
                        const url = `${origin}/relatorio-corretivo/${visit.publicToken}/interno`;
                        if (navigator.share) {
                          try { await navigator.share({ title: 'Relatório Interno', url }); } catch {}
                        } else {
                          await navigator.clipboard.writeText(url);
                          toast({ title: 'Link copiado!' });
                        }
                      }}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Time Interno
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    asChild
                  >
                    <Link to={`/chamados/${visit.ticket_id}`}>
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Ver Chamado
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    asChild
                  >
                    <Link to="/preventivas/minhas-rotas">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Minhas Rotas
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Fixed Footer - Encerrar Visita */}
      {hasCheckedIn && !isVisitCompleted && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            <Button 
              onClick={handleEncerrarClick}
              disabled={!canFinishVisit || completeMutation.isPending}
              className="w-full"
              size="lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Encerrar Visita
            </Button>
            {!canFinishVisit && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Conclua o checklist para encerrar a visita
              </p>
            )}
          </div>
        </div>
      )}

      {/* Warning Dialog (observations empty) */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Atenção
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Os seguintes campos estão vazios:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {validationResult?.warnings.map((warning, i) => (
                    <li key={i} className="text-amber-600">{warning}</li>
                  ))}
                </ul>
                <p className="mt-3">Deseja continuar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e preencher</AlertDialogCancel>
            <AlertDialogAction onClick={handleProceedAfterWarning}>
              Continuar assim mesmo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result Selection Dialog */}
      <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resultado da Visita</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Qual foi o resultado desta visita corretiva?</p>
                <div className="grid gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 border-green-500/30 hover:bg-green-500/10 hover:border-green-500"
                    onClick={() => handleResultSelection('resolvido')}
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Resolvido</p>
                      <p className="text-xs text-muted-foreground">Problema solucionado, chamado será encerrado</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500"
                    onClick={() => handleResultSelection('parcial')}
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-500 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Parcialmente Resolvido</p>
                      <p className="text-xs text-muted-foreground">Requer nova visita, chamado permanece aberto</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500"
                    onClick={() => handleResultSelection('aguardando_peca')}
                  >
                    <Clock className="h-5 w-5 text-blue-500 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Aguardando Peça</p>
                      <p className="text-xs text-muted-foreground">Peça solicitada, chamado permanece aberto</p>
                    </div>
                  </Button>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar encerramento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Isso marcará a visita como concluída. Você poderá visualizar o resumo mas não poderá editar as respostas.</p>
                
                {selectedResult && (
                  <div className={`rounded-lg p-3 ${
                    selectedResult === 'resolvido' ? 'bg-green-500/10 border border-green-500/30' :
                    selectedResult === 'parcial' ? 'bg-amber-500/10 border border-amber-500/30' :
                    'bg-blue-500/10 border border-blue-500/30'
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1">Resultado selecionado</p>
                    <p className="font-semibold">
                      {selectedResult === 'resolvido' && '✓ Resolvido - Chamado será encerrado'}
                      {selectedResult === 'parcial' && '⚠ Parcialmente resolvido - Chamado permanece aberto'}
                      {selectedResult === 'aguardando_peca' && '⏳ Aguardando peça - Chamado permanece aberto'}
                    </p>
                  </div>
                )}
                
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Data e hora de encerramento</p>
                  <p className="text-base font-semibold text-foreground">
                    {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedResult(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedResult && completeMutation.mutate(selectedResult)}
              disabled={completeMutation.isPending || !selectedResult}
            >
              {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
