import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCliente360Data, PRODUCT_ORDER, PRODUCT_LABELS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';
import { ProductBadge } from '@/components/crm/ProductBadge';
import { ProductCard } from '@/components/crm/ProductCard';
import { QualificarProdutoModal } from '@/components/crm/QualificarProdutoModal';
import { CriarPropostaModal } from '@/components/crm/CriarPropostaModal';
import { AtualizarNegociacaoModal } from '@/components/crm/AtualizarNegociacaoModal';
import { CriarAcaoModal } from '@/components/crm/CriarAcaoModal';
import { FinalizarVisitaModal } from '@/components/crm/FinalizarVisitaModal';
import { AudioRecorderButton } from '@/components/crm/AudioRecorderButton';
import { VisitAudioList } from '@/components/crm/VisitAudioList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Clock, Navigation, Loader2, CheckCircle2, LogOut, Plus, ClipboardList, FileText, Timer, ExternalLink, XCircle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CheckinDialog } from '@/components/preventivas/CheckinDialog';
import { cn } from '@/lib/utils';
import { offlineDb } from '@/lib/offline-db';
import { CancelarVisitaCrmDialog } from '@/components/crm/CancelarVisitaCrmDialog';

const STATUS_LABELS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export default function CrmVisitaExecucao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state as { from?: string; fromLabel?: string } | null;
  const backPath = fromState?.from || '/crm/visitas';
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Modals
  const [qualModal, setQualModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [propModal, setPropModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [negModal, setNegModal] = useState<{ open: boolean; cpId: string; pc: ProductCode; stage: CrmStage }>({ open: false, cpId: '', pc: 'ideagri', stage: 'nao_qualificado' });
  const [actionModal, setActionModal] = useState(false);
  const [recordingProduct, setRecordingProduct] = useState<ProductCode | null>(null);
  const [audioRefreshKey, setAudioRefreshKey] = useState(0);

  // Local audio counts per product from IndexedDB
  const localAudioCounts = useLiveQuery(
    async () => {
      if (!id) return {};
      const audios = await offlineDb.crm_visit_audios.where('visit_id').equals(id).toArray();
      const counts: Record<string, number> = {};
      for (const a of audios) {
        counts[a.product_code] = (counts[a.product_code] || 0) + 1;
      }
      return counts;
    },
    [id, audioRefreshKey],
    {}
  );

  // Fetch visit
  // @ts-ignore
  const { data: visit, isLoading: loadingVisit } = useQuery({
    queryKey: ['crm-visit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_visits')
        .select('*, clientes(id, nome, fazenda, cidade, estado, telefone, email, consultor_rplus_id)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const clientId = visit?.client_id;

  const {
    clientProducts, snapshots, metricDefs, actions, proposals, lossReasons,
    refetchProducts, refetchActions, refetchProposals,
  } = useCliente360Data(clientId);

  // Fetch visit checklists
  // @ts-ignore
  const { data: visitChecklists, refetch: refetchChecklists } = useQuery({
    queryKey: ['crm-visit-checklists', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_visit_checklists')
        .select('*, checklist_templates(name)')
        .eq('visit_id', id)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  // Fetch product snapshots for completed visits
  // @ts-ignore
  const { data: productSnapshots } = useQuery({
    queryKey: ['crm-visit-product-snapshots', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_visit_product_snapshots')
        .select('*')
        .eq('visit_id', id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id && visit?.status === 'concluida',
  });

  // Check-in mutation
  // @ts-ignore
  const checkinMutation = useMutation({
    mutationFn: async ({ lat, lon }: { lat: number | null; lon: number | null }) => {
      const { error } = await supabase
        .from('crm_visits')
        .update({
          status: 'em_andamento',
          checkin_at: new Date().toISOString(),
          checkin_lat: lat,
          checkin_lon: lon,
        })
        .eq('id', id);
      if (error) throw error;

      // Auto-attach checklists for 'ganho' products
      const wonProducts = clientProducts.filter((p: any) => p.stage === 'ganho');
      if (wonProducts.length > 0) {
        const { data: rules } = await supabase
          .from('crm_checklist_rules')
          .select('*')
          .in('product_code', wonProducts.map((p: any) => p.product_code))
          .eq('is_active', true)
          .order('priority');

        if (rules && rules.length > 0) {
          const inserts = rules.map((r: any) => ({
            visit_id: id,
            checklist_template_id: r.checklist_template_id,
            product_code: r.product_code,
            origin: 'auto',
            started_at: new Date().toISOString(),
          }));
          await supabase.from('crm_visit_checklists').insert(inserts);
        }
      }
    },
    onSuccess: () => {
      setCheckinOpen(false);
      queryClient.invalidateQueries({ queryKey: ['crm-visit', id] });
      refetchChecklists();
      toast({ title: 'Check-in realizado!' });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro no check-in', description: e.message });
    },
  });

  const handleCheckinConfirm = (lat: number | null, lon: number | null) => {
    checkinMutation.mutate({ lat, lon });
  };

  // Cancel visit mutation
  // @ts-ignore
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from('crm_visits')
        .update({ status: 'cancelada', cancellation_reason: reason })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCancelOpen(false);
      toast({ title: 'Visita cancelada.' });
      navigate(backPath);
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  if (loadingVisit) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!visit) {
    return <div className="text-center py-12 text-muted-foreground">Visita não encontrada</div>;
  }

  const isPlanned = visit.status === 'planejada';
  const isActive = visit.status === 'em_andamento';
  const isCompleted = visit.status === 'concluida';
  const wonProducts = clientProducts.filter((p: any) => p.stage === 'ganho');

  // Duration calculation
  const durationMinutes = visit.checkout_at && visit.checkin_at
    ? differenceInMinutes(new Date(visit.checkout_at), new Date(visit.checkin_at))
    : null;
  const durationLabel = durationMinutes != null
    ? durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}min`
      : `${durationMinutes}min`
    : null;

  const isCancelled = visit.status === 'cancelada';

  return (
    <div className="space-y-6 animate-fade-in pb-24 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{visit.clientes?.nome}</h1>
          {visit.clientes?.fazenda && <p className="text-muted-foreground text-sm">{visit.clientes.fazenda}</p>}
        </div>
        <Badge className={`text-xs shrink-0 ${
          isPlanned ? 'bg-blue-100 text-blue-800' :
          isActive ? 'bg-amber-100 text-amber-800' :
          isCompleted ? 'bg-green-100 text-green-800' :
          'bg-muted text-muted-foreground'
        }`}>{STATUS_LABELS[visit.status]}</Badge>
      </div>

      {/* Visit info */}
      <Card>
        <CardContent className="py-3 space-y-2 text-sm">
          {visit.objective && <p><span className="text-muted-foreground">Objetivo:</span> {visit.objective}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Criada: {format(new Date(visit.created_at), "dd/MM 'às' HH:mm")}</span>
            {visit.checkin_at && (
              <span className="flex items-center gap-1 text-green-600">
                <MapPin className="h-3.5 w-3.5" /> Check-in: {format(new Date(visit.checkin_at), "HH:mm")}
                {visit.checkin_lat && visit.checkin_lon && (
                  <a href={`https://www.google.com/maps?q=${visit.checkin_lat},${visit.checkin_lon}`} target="_blank" rel="noopener noreferrer" className="ml-0.5 hover:opacity-70" title="Ver no mapa">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            )}
            {visit.checkout_at && (
              <span className="flex items-center gap-1 text-primary">
                <LogOut className="h-3.5 w-3.5" /> Check-out: {format(new Date(visit.checkout_at), "HH:mm")}
                {visit.checkout_lat && visit.checkout_lon && (
                  <a href={`https://www.google.com/maps?q=${visit.checkout_lat},${visit.checkout_lon}`} target="_blank" rel="noopener noreferrer" className="ml-0.5 hover:opacity-70" title="Ver no mapa">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            )}
            {durationLabel && (
              <span className="flex items-center gap-1 text-foreground font-medium"><Timer className="h-3.5 w-3.5" /> Duração: {durationLabel}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isPlanned && (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" className="flex-1 min-w-0" onClick={() => setCheckinOpen(true)}>
            <Navigation className="mr-2 h-5 w-5" />
            Fazer Check-in
          </Button>
          <Button size="lg" variant="outline" className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
            <XCircle className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      )}

      {isActive && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button size="lg" variant="outline" className="flex-1 min-w-0 gap-1" onClick={() => setActionModal(true)}>
              <Plus className="h-4 w-4" /> Ação
            </Button>
            <Button size="lg" className="flex-1 min-w-0 gap-1" onClick={() => setFinalizarOpen(true)}>
              <CheckCircle2 className="h-4 w-4" /> Finalizar
            </Button>
          </div>
          <Button size="lg" variant="outline" className="w-full gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
            <XCircle className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      )}

      {/* Cancellation reason card */}
      {isCancelled && visit.cancellation_reason && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-1.5 mb-1">
              <XCircle className="h-4 w-4" /> Visita Cancelada
            </p>
            <p className="text-sm text-muted-foreground">{visit.cancellation_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Proposals section (for completed visits, show before products) */}
      {proposals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Propostas</h2>
          <div className="space-y-2">
            {proposals.map((p: any) => {
              const pc = p.crm_client_products?.product_code as ProductCode | undefined;
              const statusMap: Record<string, { label: string; cls: string }> = {
                rascunho: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
                enviada: { label: 'Enviada', cls: 'bg-blue-50 text-blue-700 border-blue-300' },
                aceita: { label: 'Aceita', cls: 'bg-green-50 text-green-700 border-green-300' },
                recusada: { label: 'Recusada', cls: 'bg-red-50 text-red-700 border-red-300' },
              };
              const st = statusMap[p.status] || { label: p.status, cls: '' };
              return (
                <Card key={p.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {pc && <ProductBadge productCode={pc} />}
                      {p.proposed_value != null && (
                        <p className="text-sm font-medium">
                          {Number(p.proposed_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      )}
                      <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                        {p.sent_at && <span>Enviada: {format(new Date(p.sent_at), 'dd/MM/yyyy')}</span>}
                        {p.valid_until && <span>Validade: {format(new Date(p.valid_until), 'dd/MM/yyyy')}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", st.cls)}>{st.label}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Produtos</h2>
          <Link to={`/crm/${clientId}`} className="text-xs text-primary hover:underline">Ver 360°</Link>
        </div>
        {isPlanned && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-3">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Faça o check-in para liberar a edição dos produtos.</span>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_ORDER.map(pc => {
            const cp = clientProducts.find((p: any) => p.product_code === pc);
            if (!cp) return null;
            const snap = snapshots.find((s: any) => s.product_code === pc);
            // Use snapshot data for completed visits when available
            const visitSnap = isCompleted && productSnapshots
              ? productSnapshots.find((s: any) => s.product_code === pc)
              : null;
            const displayStage = visitSnap ? visitSnap.stage : cp.stage;
            const displayLossReasonId = visitSnap ? visitSnap.loss_reason_id : cp.loss_reason_id;
            const displayLossNotes = visitSnap ? visitSnap.loss_notes : cp.loss_notes;
            return (
              <ProductCard
                key={pc}
                productCode={pc}
                stage={displayStage as CrmStage}
                snapshot={snap}
                metricDefs={metricDefs}
                lossReasons={lossReasons}
                lossReasonId={displayLossReasonId}
                lossNotes={displayLossNotes}
                readOnly={!isActive}
                onQualify={() => setQualModal({ open: true, cpId: cp.id, pc })}
                onCreateProposal={() => setPropModal({ open: true, cpId: cp.id, pc })}
                onUpdateNegotiation={() => setNegModal({ open: true, cpId: cp.id, pc, stage: cp.stage as CrmStage })}
                onRecordAudio={isActive ? () => setRecordingProduct(pc) : undefined}
                audioCount={localAudioCounts[pc] || 0}
              />
            );
          })}
        </div>
      </div>

      {/* Audio Recorder (shown when recording a product) */}
      {isActive && recordingProduct && id && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg p-4 flex items-center gap-3">
          <ProductBadge productCode={recordingProduct} className="text-xs px-2 py-0.5" />
          <AudioRecorderButton
            visitId={id}
            productCode={recordingProduct}
            onRecorded={() => {
              setRecordingProduct(null);
              setAudioRefreshKey(k => k + 1);
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setRecordingProduct(null)}>Cancelar</Button>
        </div>
      )}

      {/* Visit Audio List */}
      {id && <VisitAudioList visitId={id} visitStatus={visit?.status} />}

      {/* Checklists attached to this visit */}
      {visitChecklists && visitChecklists.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Checklists da Visita</h2>
          <div className="space-y-2">
            {visitChecklists.map((vc: any) => (
              <Card key={vc.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{vc.checklist_templates?.name || 'Checklist'}</p>
                      {vc.product_code && <span className="text-xs text-muted-foreground">{PRODUCT_LABELS[vc.product_code as ProductCode]}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {vc.status === 'concluido' ? 'Concluído' : 'Em andamento'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Actions */}
      {actions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Ações</h2>
          <div className="space-y-2">
            {actions.map((a: any) => (
              <Card key={a.id} className={cn(a.status === 'concluida' && 'opacity-60')}>
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium truncate", a.status === 'concluida' && 'line-through')}>{a.title}</p>
                    {a.due_at && <p className="text-[11px] text-muted-foreground">{format(new Date(a.due_at), 'dd/MM/yyyy')}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    <Badge variant="outline" className={cn("text-[10px]",
                      a.status === 'concluida' ? 'bg-green-50 text-green-700 border-green-300' :
                      a.status === 'cancelada' ? 'bg-gray-50 text-gray-500 border-gray-300' :
                      'bg-amber-50 text-amber-700 border-amber-300'
                    )}>
                      {a.status === 'concluida' ? 'Concluída' : a.status === 'cancelada' ? 'Cancelada' : 'Pendente'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <QualificarProdutoModal open={qualModal.open} onOpenChange={o => setQualModal(p => ({ ...p, open: o }))} clientProductId={qualModal.cpId} productCode={qualModal.pc} onQualified={() => refetchProducts()} />
      <CriarPropostaModal open={propModal.open} onOpenChange={o => setPropModal(p => ({ ...p, open: o }))} clientProductId={propModal.cpId} productCode={propModal.pc} onCreated={() => refetchProducts()} />
      <AtualizarNegociacaoModal open={negModal.open} onOpenChange={o => setNegModal(p => ({ ...p, open: o }))} clientProductId={negModal.cpId} productCode={negModal.pc} currentStage={negModal.stage} lossReasons={lossReasons} onUpdated={() => refetchProducts()} />
      <CriarAcaoModal open={actionModal} onOpenChange={setActionModal} clientId={clientId || ''} onCreated={() => refetchActions()} />
      <FinalizarVisitaModal
        open={finalizarOpen}
        onOpenChange={setFinalizarOpen}
        visitId={id!}
        clientId={clientId || ''}
        onFinalized={() => {
          queryClient.invalidateQueries({ queryKey: ['crm-visit', id] });
          navigate(backPath);
        }}
      />
      <CheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        farmName={visit.clientes?.nome || ''}
        farmFazenda={visit.clientes?.fazenda}
        onConfirm={handleCheckinConfirm}
        isLoading={checkinMutation.isPending}
      />
      <CancelarVisitaCrmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        clientName={visit.clientes?.nome || ''}
        farmName={visit.clientes?.fazenda}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
