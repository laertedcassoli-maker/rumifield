import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCliente360Data, PRODUCT_ORDER, PRODUCT_LABELS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';
import { ProductCard } from '@/components/crm/ProductCard';
import { QualificarProdutoModal } from '@/components/crm/QualificarProdutoModal';
import { CriarPropostaModal } from '@/components/crm/CriarPropostaModal';
import { AtualizarNegociacaoModal } from '@/components/crm/AtualizarNegociacaoModal';
import { CriarAcaoModal } from '@/components/crm/CriarAcaoModal';
import { FinalizarVisitaModal } from '@/components/crm/FinalizarVisitaModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Clock, Navigation, Loader2, CheckCircle2, LogOut, Plus, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export default function CrmVisitaExecucao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const geo = useGeolocation();

  const [finalizarOpen, setFinalizarOpen] = useState(false);

  // Modals
  const [qualModal, setQualModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [propModal, setPropModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [negModal, setNegModal] = useState<{ open: boolean; cpId: string; pc: ProductCode; stage: CrmStage }>({ open: false, cpId: '', pc: 'ideagri', stage: 'nao_qualificado' });
  const [actionModal, setActionModal] = useState(false);

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
    refetchProducts, refetchActions,
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

  // Check-in mutation
  // @ts-ignore
  const checkinMutation = useMutation({
    mutationFn: async () => {
      let lat: number | null = null;
      let lon: number | null = null;
      try {
        await geo.getLocation();
        lat = geo.latitude;
        lon = geo.longitude;
      } catch { /* proceed without geo */ }

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
      queryClient.invalidateQueries({ queryKey: ['crm-visit', id] });
      refetchChecklists();
      toast({ title: 'Check-in realizado!' });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro no check-in', description: e.message });
    },
  });

  const handleCheckin = () => {
    checkinMutation.mutate();
  };

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

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crm/visitas')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{visit.clientes?.nome}</h1>
          {visit.clientes?.fazenda && <p className="text-muted-foreground text-sm">{visit.clientes.fazenda}</p>}
        </div>
        <Badge className={`text-xs ${
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
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Criada: {format(new Date(visit.created_at), "dd/MM 'às' HH:mm")}</span>
            {visit.checkin_at && (
              <span className="flex items-center gap-1 text-green-600"><MapPin className="h-3.5 w-3.5" /> Check-in: {format(new Date(visit.checkin_at), "HH:mm")}</span>
            )}
            {visit.checkout_at && (
              <span className="flex items-center gap-1 text-primary"><LogOut className="h-3.5 w-3.5" /> Check-out: {format(new Date(visit.checkout_at), "HH:mm")}</span>
            )}
          </div>
          {visit.summary && <p><span className="text-muted-foreground">Resumo:</span> {visit.summary}</p>}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isPlanned && (
        <Button size="lg" className="w-full" onClick={handleCheckin} disabled={checkinMutation.isPending}>
          {checkinMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Navigation className="mr-2 h-5 w-5" />}
          Fazer Check-in
        </Button>
      )}

      {isActive && (
        <div className="flex gap-2">
          <Button size="lg" variant="outline" className="flex-1 gap-1" onClick={() => setActionModal(true)}>
            <Plus className="h-4 w-4" /> Ação
          </Button>
          <Button size="lg" className="flex-1 gap-1" onClick={() => setFinalizarOpen(true)}>
            <CheckCircle2 className="h-4 w-4" /> Finalizar
          </Button>
        </div>
      )}

      {/* Product Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Produtos</h2>
          <Link to={`/crm/${clientId}`} className="text-xs text-primary hover:underline">Ver 360°</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_ORDER.map(pc => {
            const cp = clientProducts.find((p: any) => p.product_code === pc);
            if (!cp) return null;
            const snap = snapshots.find((s: any) => s.product_code === pc);
            return (
              <ProductCard
                key={pc}
                productCode={pc}
                stage={cp.stage as CrmStage}
                snapshot={snap}
                metricDefs={metricDefs}
                lossReasons={lossReasons}
                lossReasonId={cp.loss_reason_id}
                lossNotes={cp.loss_notes}
                onQualify={() => setQualModal({ open: true, cpId: cp.id, pc })}
                onCreateProposal={() => setPropModal({ open: true, cpId: cp.id, pc })}
                onUpdateNegotiation={() => setNegModal({ open: true, cpId: cp.id, pc, stage: cp.stage as CrmStage })}
              />
            );
          })}
        </div>
      </div>

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
          navigate('/crm/visitas');
        }}
      />
    </div>
  );
}
