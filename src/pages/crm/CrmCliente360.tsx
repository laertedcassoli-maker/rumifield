import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente360Data, PRODUCT_ORDER, STAGE_LABELS, PRODUCT_LABELS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';
import { ProductCard } from '@/components/crm/ProductCard';
import { QualificarProdutoModal } from '@/components/crm/QualificarProdutoModal';
import { CriarPropostaModal } from '@/components/crm/CriarPropostaModal';
import { AtualizarNegociacaoModal } from '@/components/crm/AtualizarNegociacaoModal';
import { CriarAcaoModal } from '@/components/crm/CriarAcaoModal';
import { ClienteHistoricoTab } from '@/components/crm/ClienteHistoricoTab';
import { EditarAcaoSheet } from '@/components/crm/EditarAcaoSheet';
import type { UnifiedAction, ActionStatus } from '@/hooks/useCrmAcoesData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClienteAnaliseIA } from '@/components/crm/ClienteAnaliseIA';
import { ArrowLeft, MapPin, Phone, Mail, Plus, Clock, Eye, User, ChevronRight, CheckCircle2, MessageSquare, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OpportunityNotes } from '@/components/crm/OpportunityNotes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CrmCliente360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state as { from?: string; fromLabel?: string } | null;
  const fromPath = fromState?.from || '/crm/carteira';
  const fromLabel = fromState?.fromLabel || 'Carteira';

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['crm-cliente', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: consultor } = useQuery({
    queryKey: ['crm-consultor', cliente?.consultor_rplus_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('nome, email').eq('id', cliente!.consultor_rplus_id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!cliente?.consultor_rplus_id,
  });

  const {
    clientProducts, snapshots, metricDefs, actions, proposals, lossReasons,
    isLoading, refetchProducts, refetchActions, refetchProposals,
  } = useCliente360Data(id);

  // @ts-ignore
  const { data: visits } = useQuery({
    queryKey: ['crm-360-visits', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_visits')
        .select('id, status, objective, summary, checkin_at, checkout_at, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  // Fetch note counts per opportunity
  const { data: noteCounts } = useQuery({
    queryKey: ['crm-opportunity-notes-counts', id],
    queryFn: async () => {
      const cpIds = clientProducts.map((cp: any) => cp.id);
      if (cpIds.length === 0) return {};
      const { data, error } = await (supabase as any)
        .from('crm_opportunity_notes')
        .select('client_product_id')
        .in('client_product_id', cpIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((n: any) => {
        counts[n.client_product_id] = (counts[n.client_product_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!id && clientProducts.length > 0,
  });

  // Modals state
  const [qualModal, setQualModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [propModal, setPropModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [negModal, setNegModal] = useState<{ open: boolean; cpId: string; pc: ProductCode; stage: CrmStage }>({ open: false, cpId: '', pc: 'ideagri', stage: 'nao_qualificado' });
  const [actionModal, setActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<UnifiedAction | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  if (loadingCliente || isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cliente) {
    return <div className="text-center py-12 text-muted-foreground">Cliente não encontrado</div>;
  }

  

  // Map actions to UnifiedAction format for EditarAcaoSheet
  const mapToUnified = (a: any): UnifiedAction => ({
    id: a.id,
    title: a.title,
    type: a.type,
    status: a.status as ActionStatus,
    due_at: a.due_at,
    priority: a.priority,
    description: a.description,
    owner_user_id: a.owner_user_id,
    owner_name: null,
    clientes: cliente ? { id: cliente.id, nome: cliente.nome } : null,
    _source: 'action',
    product_code: null,
  });

  const activeActions = actions.filter((a: any) => a.status !== 'concluida').map(mapToUnified);
  const doneActions = actions.filter((a: any) => a.status === 'concluida').map(mapToUnified);

  const handleOpenAction = (ua: UnifiedAction) => {
    setSelectedAction(ua);
    setActionSheetOpen(true);
  };

  const handleActionSheetChange = (open: boolean) => {
    setActionSheetOpen(open);
    if (!open) {
      // Refetch local data when sheet closes
      refetchActions();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to={fromPath} className="hover:text-foreground transition-colors">{fromLabel}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{cliente.nome}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{cliente.nome}</h1>
          {cliente.fazenda && <p className="text-muted-foreground text-sm">{cliente.fazenda}</p>}
        </div>
        <div className="flex items-center gap-2">
          <ClienteAnaliseIA clientId={id!} clientName={cliente.nome} />
          <Button size="sm" variant="outline" onClick={() => setActionModal(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Ação
          </Button>
        </div>
      </div>

      {/* Contact + Consultor */}
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-4 text-sm">
          {cliente.cidade && (
            <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {cliente.cidade}{cliente.estado ? `/${cliente.estado}` : ''}</span>
          )}
          {cliente.telefone && (
            <a href={`tel:${cliente.telefone}`} className="flex items-center gap-1 text-primary"><Phone className="h-3.5 w-3.5" /> {cliente.telefone}</a>
          )}
          {cliente.email && (
            <a href={`mailto:${cliente.email}`} className="flex items-center gap-1 text-primary"><Mail className="h-3.5 w-3.5" /> {cliente.email}</a>
          )}
          {consultor && (
            <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3.5 w-3.5" /> {consultor.nome}</span>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Produtos | Histórico */}
      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="historico">Serviços Técnicos</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-6 mt-4">
          {/* Products Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Produtos</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {PRODUCT_ORDER.map(pc => {
                const cp = clientProducts.find((p: any) => p.product_code === pc);
                if (!cp) return null;
                const snap = snapshots.find((s: any) => s.product_code === pc);
                const noteCount = (noteCounts as Record<string, number>)?.[cp.id] || 0;
                return (
                  <div key={pc} className="space-y-0">
                    <ProductCard
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
                    <Collapsible>
                      <CollapsibleTrigger className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <MessageSquare className="h-3 w-3" />
                        {noteCount > 0 ? `${noteCount} interaç${noteCount === 1 ? 'ão' : 'ões'}` : 'Interações'}
                        <ChevronDown className="h-3 w-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-1 pb-2">
                        <OpportunityNotes clientProductId={cp.id} clientId={id!} />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </div>


          {/* Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Ações ({actions.length})</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ação registrada</p>
            ) : (
              <div className="space-y-2">
                {activeActions.map((a) => (
                  <Card key={a.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => handleOpenAction(a)}>
                    <CardContent className="py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.due_at && (
                          <span className={cn("text-xs flex items-center gap-1", new Date(a.due_at) < new Date() ? 'text-destructive' : 'text-muted-foreground')}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(a.due_at), 'dd/MM')}
                          </span>
                        )}
                        <Badge variant="outline" className={cn("text-[10px]",
                          a.status === 'aberta' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                          a.status === 'em_execucao' ? 'bg-blue-100 text-blue-800 border-blue-300' : ''
                        )}>
                          {a.status === 'aberta' ? 'Pendente' : a.status === 'em_execucao' ? 'Em Execução' : a.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {doneActions.length > 0 && doneActions.map((a) => (
                  <Card key={a.id} className="cursor-pointer opacity-60 hover:opacity-80 transition-all" onClick={() => handleOpenAction(a)}>
                    <CardContent className="py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate line-through">{a.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Concluída
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Proposals */}
          {proposals.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Oportunidades ({proposals.length})</h2>
              <div className="space-y-2">
                {proposals.map((p: any) => {
                  const cpId = p.client_product_id || (p.crm_client_products as any)?.id;
                  const noteCount = (noteCounts as Record<string, number>)?.[cpId] || 0;
                  return (
                    <div key={p.id} className="space-y-0">
                      <Card>
                        <CardContent className="py-3 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-medium">{PRODUCT_LABELS[(p.crm_client_products as any)?.product_code as ProductCode]}</span>
                            <Badge className="ml-2 text-[10px]" variant="outline">{p.status}</Badge>
                          </div>
                          <div className="text-right text-sm">
                            {p.proposed_value && <span className="font-medium">R$ {Number(p.proposed_value).toLocaleString('pt-BR')}</span>}
                            {p.valid_until && <p className="text-[11px] text-muted-foreground">Validade: {format(new Date(p.valid_until), 'dd/MM/yyyy')}</p>}
                          </div>
                        </CardContent>
                      </Card>
                      <Collapsible>
                        <CollapsibleTrigger className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <MessageSquare className="h-3 w-3" />
                          {noteCount > 0 ? `${noteCount} interaç${noteCount === 1 ? 'ão' : 'ões'}` : 'Interações'}
                          <ChevronDown className="h-3 w-3" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-1 pb-2">
                          <OpportunityNotes clientProductId={cpId} clientId={id!} />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visitas CRM */}
          {visits && visits.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Visitas Recentes</h2>
                <Link to="/crm/visitas" className="text-xs text-primary hover:underline">Ver todas</Link>
              </div>
              <div className="space-y-2">
                {visits.map((v: any) => (
                  <Link to={`/crm/visitas/${v.id}`} key={v.id} state={{ from: `/crm/${id}`, fromLabel: cliente.nome }}>
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{v.objective || 'Visita'}</span>
                            <Badge variant="outline" className={cn("text-[10px]", 
                              v.status === 'concluida' ? 'bg-green-50 text-green-700 border-green-300' :
                              v.status === 'em_andamento' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                              v.status === 'planejada' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                              v.status === 'cancelada' ? 'bg-gray-50 text-gray-500 border-gray-300' : ''
                            )}>
                              {v.status === 'em_andamento' ? 'Em Andamento' : 
                               v.status === 'planejada' ? 'Planejada' : 
                               v.status === 'concluida' ? 'Concluída' : 
                               v.status === 'cancelada' ? 'Cancelada' : v.status}
                            </Badge>
                          </div>
                          {v.summary && <p className="text-xs text-muted-foreground truncate mt-0.5">{v.summary}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(v.created_at), "dd/MM", { locale: ptBR })}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <ClienteHistoricoTab clientId={id!} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <QualificarProdutoModal
        open={qualModal.open}
        onOpenChange={(o) => setQualModal(p => ({ ...p, open: o }))}
        clientProductId={qualModal.cpId}
        productCode={qualModal.pc}
        onQualified={() => refetchProducts()}
      />
      <CriarPropostaModal
        open={propModal.open}
        onOpenChange={(o) => setPropModal(p => ({ ...p, open: o }))}
        clientProductId={propModal.cpId}
        productCode={propModal.pc}
        onCreated={() => { refetchProducts(); refetchProposals(); }}
      />
      <AtualizarNegociacaoModal
        open={negModal.open}
        onOpenChange={(o) => setNegModal(p => ({ ...p, open: o }))}
        clientProductId={negModal.cpId}
        productCode={negModal.pc}
        currentStage={negModal.stage}
        lossReasons={lossReasons}
        onUpdated={() => refetchProducts()}
      />
      <CriarAcaoModal
        open={actionModal}
        onOpenChange={setActionModal}
        clientId={id!}
        onCreated={() => refetchActions()}
      />
      <EditarAcaoSheet
        action={selectedAction}
        open={actionSheetOpen}
        onOpenChange={handleActionSheetChange}
      />
    </div>
  );
}
