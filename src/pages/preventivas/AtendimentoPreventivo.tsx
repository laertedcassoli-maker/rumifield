import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  Share2,
  User,
  FileText,
  WifiOff
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
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

export default function AtendimentoPreventivo() {
  const { routeId, itemId } = useParams<{ routeId: string; itemId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch route item details
  const { data: routeItem, isLoading, isOfflineData, refetchOffline } = useOfflineQuery({
    queryKey: ['route-item-attendance', itemId],
    queryFn: async () => {
      const { data: item, error } = await supabase
        .from('preventive_route_items')
        .select('id, client_id, status, checkin_at, checkin_lat, checkin_lon, order_index, route_id')
        .eq('id', itemId)
        .maybeSingle();

      if (error) throw error;
      if (!item) return null;

      // Fetch route details
      const { data: route } = await supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, field_technician_user_id, checklist_template_id')
        .eq('id', item.route_id)
        .maybeSingle();

      // Fetch client details
      const { data: client } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado')
        .eq('id', item.client_id)
        .maybeSingle();

      // Fetch or find preventive_maintenance record by route_id (unique constraint)
      let preventiveId: string | null = null;
      let internalNotes: string | null = null;
      let publicNotes: string | null = null;
      
      const { data: existingPm } = await supabase
        .from('preventive_maintenance')
        .select('id, internal_notes, public_notes, public_token')
        .eq('client_id', item.client_id)
        .eq('route_id', item.route_id)
        .maybeSingle();

      let publicToken: string | null = null;

      if (existingPm) {
        preventiveId = existingPm.id;
        internalNotes = existingPm.internal_notes;
        publicNotes = existingPm.public_notes;
        publicToken = existingPm.public_token;
      } else if (route?.start_date) {
        // Create preventive_maintenance record with route_id (ensures uniqueness)
        const { data: newPm, error: pmError } = await supabase
          .from('preventive_maintenance')
          .insert([{
            client_id: item.client_id,
            route_id: item.route_id,
            scheduled_date: route.start_date,
            status: 'planejada' as const,
            technician_user_id: route.field_technician_user_id,
            notes: `Atendimento via rota ${route.route_code}`,
          }])
          .select('id')
          .single();

        if (!pmError && newPm) {
          preventiveId = newPm.id;
        }
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
        ...item,
        route,
        client,
        preventiveId,
        internalNotes,
        publicNotes,
        publicToken,
      };
    },
    enabled: !!itemId,
    offlineFn: async () => {
      // Fallback: build data from Dexie cached tables
      const item = await offlineDb.rota_items.get(itemId!);
      if (!item) return null;

      const route = await offlineDb.rotas.get(item.route_id);
      const client = await offlineDb.clientes.get(item.client_id);

      // Try to find preventive from Dexie
      let preventiveRecord = await offlineDb.preventivas
        .filter(p => p.client_id === item.client_id && p.route_id === item.route_id)
        .first();

      // If not found, create one locally (fallback for offline check-in)
      if (!preventiveRecord && route) {
        const pmId = crypto.randomUUID();
        const newPm = {
          id: pmId,
          client_id: item.client_id,
          route_id: item.route_id,
          scheduled_date: route.start_date || new Date().toISOString().split('T')[0],
          status: 'planejada',
          technician_user_id: route.field_technician_user_id || null,
          notes: `Atendimento via rota ${route.route_code || ''}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await offlineDb.preventivas.put(newPm);
        await offlineDb.addToSyncQueue('preventive_maintenance', 'insert', {
          id: pmId,
          client_id: item.client_id,
          route_id: item.route_id,
          scheduled_date: route.start_date || new Date().toISOString().split('T')[0],
          status: 'planejada',
          technician_user_id: route.field_technician_user_id,
          notes: `Atendimento via rota ${route.route_code || ''}`,
        });
        preventiveRecord = newPm;
      }

      return {
        id: item.id,
        client_id: item.client_id,
        status: item.status,
        checkin_at: item.checkin_at,
        checkin_lat: item.checkin_lat,
        checkin_lon: item.checkin_lon,
        order_index: item.order_index,
        route_id: item.route_id,
        route: route ? {
          id: route.id,
          route_code: route.route_code,
          start_date: route.start_date,
          field_technician_user_id: route.field_technician_user_id,
          checklist_template_id: route.checklist_template_id,
        } : null,
        client: client ? {
          id: client.id,
          nome: client.nome,
          fazenda: client.fazenda,
          cidade: client.cidade,
          estado: client.estado,
        } : null,
        preventiveId: preventiveRecord?.id || null,
        internalNotes: preventiveRecord?.internal_notes || null,
        publicNotes: preventiveRecord?.public_notes || null,
        publicToken: preventiveRecord?.public_token || null,
      };
    },
  });

  // Complete attendance mutation (Encerrar Visita)
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!routeItem) throw new Error('Item não encontrado');

      // Update route item status to executado
      const { error: itemError } = await supabase
        .from('preventive_route_items')
        .update({ status: 'executado' })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Update preventive_maintenance to concluida
      if (routeItem.preventiveId) {
        const { error: pmError } = await supabase
          .from('preventive_maintenance')
          .update({
            status: 'concluida',
            completed_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', routeItem.preventiveId);

        if (pmError) throw pmError;

        // --- Auto-create pedido for parts with stock_source = 'novo_pedido' ---
        const { data: novoPedidoParts } = await supabase
          .from('preventive_part_consumption')
          .select('part_id, part_name_snapshot, quantity')
          .eq('preventive_id', routeItem.preventiveId)
          .eq('stock_source', 'novo_pedido');

        if (novoPedidoParts && novoPedidoParts.length > 0 && user) {
          const { data: pedido, error: pedidoError } = await supabase
            .from('pedidos')
            .insert({
              cliente_id: routeItem.client_id,
              solicitante_id: user.id,
              preventive_id: routeItem.preventiveId,
              observacoes: `Gerado automaticamente na visita preventiva (rota ${routeItem.route?.route_code})`,
              origem: 'preventiva',
              tipo_envio: 'envio_fisico',
              urgencia: 'normal',
            } as any)
            .select('id')
            .single();

          if (!pedidoError && pedido) {
            // Group parts by part_id summing quantities
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
          }
        }

        // --- Auto-create pedido (apenas NF) for parts with stock_source = 'tecnico' ---
        const { data: tecnicoPartsForNF } = await supabase
          .from('preventive_part_consumption')
          .select('part_id, part_name_snapshot, quantity')
          .eq('preventive_id', routeItem.preventiveId)
          .eq('stock_source', 'tecnico');

        if (tecnicoPartsForNF && tecnicoPartsForNF.length > 0 && user) {
          const { data: pedidoNF, error: pedidoNFError } = await supabase
            .from('pedidos')
            .insert({
              cliente_id: routeItem.client_id,
              solicitante_id: user.id,
              preventive_id: routeItem.preventiveId,
              observacoes: `Peças do estoque do técnico consumidas na preventiva (rota ${routeItem.route?.route_code}) — apenas para emissão de NF/faturamento`,
              origem: 'preventiva',
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
          }
        }

        // --- Auto-create workshop_items for new asset codes (only for is_asset parts) ---
        const { data: tecnicoParts } = await supabase
          .from('preventive_part_consumption')
          .select('part_id, asset_unique_code')
          .eq('preventive_id', routeItem.preventiveId)
          .eq('stock_source', 'tecnico')
          .not('asset_unique_code', 'is', null);

        if (tecnicoParts && tecnicoParts.length > 0) {
          // Fetch which parts are actually assets
          const partIds = [...new Set(tecnicoParts.map(tp => tp.part_id))];
          const { data: assetParts } = await supabase
            .from('pecas')
            .select('id, is_asset')
            .in('id', partIds);
          const assetSet = new Set((assetParts || []).filter((p: any) => p.is_asset).map((p: any) => p.id));

          for (const tp of tecnicoParts) {
            if (!tp.asset_unique_code?.trim()) continue;
            if (!assetSet.has(tp.part_id)) continue; // Skip non-asset parts
            // Check if already exists
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
      }

      // Check if all route items are done (executado or cancelado)
      const { data: allItems } = await supabase
        .from('preventive_route_items')
        .select('status')
        .eq('route_id', routeId);

      const allDone = allItems?.every(i => i.status === 'executado' || i.status === 'cancelado');
      if (allDone && allItems && allItems.length > 0) {
        const { error: routeError } = await supabase
          .from('preventive_routes')
          .update({ status: 'finalizada' })
          .eq('id', routeId);

        if (routeError) throw routeError;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-execution', routeId] });
      queryClient.invalidateQueries({ queryKey: ['route-execution-items', routeId] });
      toast({
        title: 'Visita encerrada!',
        description: 'A fazenda foi marcada como executada.',
      });
      navigate(`/preventivas/execucao/${routeId}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao encerrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canAccess = isAdminOrCoordinator || routeItem?.route?.field_technician_user_id === user?.id;
  
  // Can only finish visit when checklist is completed
  const canFinishVisit = checklistStatus === 'completed';

  // Validation function for encerrar
  const validateBeforeComplete = async (): Promise<ValidationResult> => {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    if (!routeItem?.preventiveId) {
      return { canProceed: false, blockingErrors: ['Registro de manutenção não encontrado'], warnings: [] };
    }

    // Check for parts without stock source
    const { data: partsWithoutSource } = await supabase
      .from('preventive_part_consumption')
      .select('id, part_name_snapshot')
      .eq('preventive_id', routeItem.preventiveId)
      .is('stock_source', null);

    if (partsWithoutSource && partsWithoutSource.length > 0) {
      blockingErrors.push(`${partsWithoutSource.length} peça(s) sem origem definida (Técnico/Fazenda)`);
    }

    // Check checklist items with "troca" action have at least 1 linked part
    try {
      const { data: activeChecklist } = await supabase
        .from('preventive_checklists')
        .select('id')
        .eq('preventive_id', routeItem.preventiveId)
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
              // Check parts linked via exec_item_id (automatic parts)
              const { data: linkedParts } = await supabase
                .from('preventive_part_consumption')
                .select('exec_item_id')
                .eq('preventive_id', routeItem.preventiveId)
                .in('exec_item_id', itemIdsWithTroca);

              const itemIdsWithParts = new Set((linkedParts || []).map(p => p.exec_item_id));

              // Also check local Dexie for pending parts not yet synced (automatic)
              const localParts = await offlineChecklistDb.partConsumptions
                .filter(pc => pc.preventive_id === routeItem.preventiveId
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
                  .eq('preventive_id', routeItem.preventiveId)
                  .is('exec_item_id', null);

                const localManualParts = await offlineChecklistDb.partConsumptions
                  .filter(pc => pc.preventive_id === routeItem.preventiveId
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
      .eq('preventive_id', routeItem.preventiveId);

    if (!mediaCount || mediaCount === 0) {
      blockingErrors.push('Nenhuma foto/vídeo anexado');
    }

    // Check for empty observations (warning only)
    const { data: pmData } = await supabase
      .from('preventive_maintenance')
      .select('internal_notes, public_notes')
      .eq('id', routeItem.preventiveId)
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
      // Show blocking errors via toast
      toast({
        title: 'Não é possível encerrar',
        description: result.blockingErrors.join('. '),
        variant: 'destructive',
      });
      return;
    }

    if (result.warnings.length > 0) {
      // Show warning dialog
      setShowWarningDialog(true);
    } else {
      // No warnings, go straight to confirmation
      setShowCompleteDialog(true);
    }
  };

  const handleProceedAfterWarning = () => {
    setShowWarningDialog(false);
    setShowCompleteDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!routeItem) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Atendimento não encontrado</h2>
        <Button asChild className="mt-4" size="sm">
          <Link to={`/preventivas/execucao/${routeId}`}>Voltar</Link>
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

  const isVisitCompleted = routeItem.status === 'executado';

  return (
    <div className="space-y-4 animate-fade-in w-full pb-24">
      {/* Minimal Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to={`/preventivas/execucao/${routeId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
          {isOfflineData && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
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

      {/* Info Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h1 className="text-lg font-bold text-foreground">{routeItem.client?.nome}</h1>
          {routeItem.client?.fazenda && (
            <p className="text-sm text-muted-foreground -mt-1">{routeItem.client.fazenda}</p>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {[routeItem.client?.cidade, routeItem.client?.estado].filter(Boolean).join(' - ')}
            </span>
          </div>
          {routeItem.checkin_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Check-in: {format(parseISO(routeItem.checkin_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            <span>Rota: {routeItem.route?.route_code}</span>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Execution Block */}
      {routeItem.preventiveId ? (
        <ChecklistExecution 
          preventiveId={routeItem.preventiveId}
          routeTemplateId={routeItem.route?.checklist_template_id || undefined}
          onStatusChange={(status) => {
            setChecklistStatus(status);
            if (status === 'completed') {
              refetchOffline(); // Refresh data
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
      {routeItem.preventiveId && (
        <ConsumedPartsBlock 
          preventiveId={routeItem.preventiveId}
          isCompleted={isVisitCompleted}
        />
      )}

      {/* Observations Block */}
      {routeItem.preventiveId && (
        <ObservationsBlock 
          preventiveId={routeItem.preventiveId}
          initialInternalNotes={routeItem.internalNotes}
          initialPublicNotes={routeItem.publicNotes}
          isCompleted={isVisitCompleted}
        />
      )}

      {/* Media Upload Block */}
      {routeItem.preventiveId && (
        <VisitMediaUpload 
          preventiveId={routeItem.preventiveId}
          isCompleted={isVisitCompleted}
        />
      )}

      {/* Share Section - When Visit is Completed */}
      {isVisitCompleted && routeItem.publicToken && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-foreground">Visita Encerrada</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Compartilhe o relatório com o produtor ou sua equipe:
            </p>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  const baseUrl = window.location.hostname.includes('lovableproject.com') 
                    ? 'https://rumifield.lovable.app' 
                    : window.location.origin;
                  const url = `${baseUrl}/relatorio/${routeItem.publicToken}`;
                  const shareData = {
                    title: `Relatório - ${routeItem.client?.nome}`,
                    text: `Confira o relatório da visita preventiva: ${url}`,
                    url
                  };
                  
                  const canNativeShare = typeof navigator.share === 'function' && 
                    (!navigator.canShare || navigator.canShare(shareData));
                  
                  if (canNativeShare) {
                    try {
                      await navigator.share(shareData);
                      return;
                    } catch (err) {
                      if ((err as Error).name === 'AbortError') return;
                    }
                  }
                  
                  try {
                    await navigator.clipboard.writeText(url);
                    toast({ title: 'Link copiado!', description: 'Cole no WhatsApp para enviar' });
                  } catch {
                    toast({ title: 'Link do relatório', description: url });
                  }
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Produtor
              </Button>
              
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  const baseUrl = window.location.hostname.includes('lovableproject.com') 
                    ? 'https://rumifield.lovable.app' 
                    : window.location.origin;
                  const url = `${baseUrl}/relatorio/${routeItem.publicToken}/interno`;
                  const shareData = {
                    title: `Relatório Interno - ${routeItem.client?.nome}`,
                    text: `Relatório interno da visita preventiva: ${url}`,
                    url
                  };
                  
                  const canNativeShare = typeof navigator.share === 'function' && 
                    (!navigator.canShare || navigator.canShare(shareData));
                  
                  if (canNativeShare) {
                    try {
                      await navigator.share(shareData);
                      return;
                    } catch (err) {
                      if ((err as Error).name === 'AbortError') return;
                    }
                  }
                  
                  try {
                    await navigator.clipboard.writeText(url);
                    toast({ title: 'Link copiado!', description: 'Cole para compartilhar com a equipe' });
                  } catch {
                    toast({ title: 'Link do relatório', description: url });
                  }
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Time Interno
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fixed Footer - Encerrar Visita */}
      {!isVisitCompleted && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            <Button 
              onClick={handleEncerrarClick}
              disabled={!canFinishVisit || completeMutation.isPending || isOfflineData}
              className="w-full"
              size="lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Encerrar Visita
            </Button>
            {!canFinishVisit && !isOfflineData && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Conclua o checklist para encerrar a visita
              </p>
            )}
            {isOfflineData && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Encerrar visita requer conexão com a internet
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

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar visita?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Isso marcará a fazenda como executada na rota. Você poderá visualizar o resumo mas não poderá editar as respostas.</p>
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
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
