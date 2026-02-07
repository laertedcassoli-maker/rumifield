import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente360Data, PRODUCT_ORDER, STAGE_LABELS, PRODUCT_LABELS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';
import { ProductCard } from '@/components/crm/ProductCard';
import { QualificarProdutoModal } from '@/components/crm/QualificarProdutoModal';
import { CriarPropostaModal } from '@/components/crm/CriarPropostaModal';
import { AtualizarNegociacaoModal } from '@/components/crm/AtualizarNegociacaoModal';
import { CriarAcaoModal } from '@/components/crm/CriarAcaoModal';
import { ClienteHistoricoTab } from '@/components/crm/ClienteHistoricoTab';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, MapPin, Phone, Mail, Plus, Clock, Eye, User, ChevronRight } from 'lucide-react';
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

  // Modals state
  const [qualModal, setQualModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [propModal, setPropModal] = useState<{ open: boolean; cpId: string; pc: ProductCode }>({ open: false, cpId: '', pc: 'ideagri' });
  const [negModal, setNegModal] = useState<{ open: boolean; cpId: string; pc: ProductCode; stage: CrmStage }>({ open: false, cpId: '', pc: 'ideagri', stage: 'nao_qualificado' });
  const [actionModal, setActionModal] = useState(false);

  if (loadingCliente || isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cliente) {
    return <div className="text-center py-12 text-muted-foreground">Cliente não encontrado</div>;
  }

  const openOpps = clientProducts.filter((p: any) => ['qualificado', 'proposta', 'negociacao'].includes(p.stage));
  const openActions = actions.filter((a: any) => a.status !== 'concluida');

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
        <Button size="sm" variant="outline" onClick={() => setActionModal(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Ação
        </Button>
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
          <TabsTrigger value="historico">Histórico</TabsTrigger>
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

          {/* Opportunities */}
          {openOpps.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Oportunidades ({openOpps.length})</h2>
              <div className="space-y-2">
                {openOpps.map((op: any) => (
                  <Card key={op.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{PRODUCT_LABELS[op.product_code as ProductCode]}</span>
                        <Badge className="ml-2 text-[10px]" variant="outline">{STAGE_LABELS[op.stage as CrmStage]}</Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {op.value_estimated && (
                          <span className="text-sm font-medium">R$ {Number(op.value_estimated).toLocaleString('pt-BR')}</span>
                        )}
                        {op.stage_updated_at && (
                          <span className="text-xs text-muted-foreground">{format(new Date(op.stage_updated_at), 'dd/MM/yyyy')}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Pendências ({openActions.length})</h2>
            {openActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma pendência aberta</p>
            ) : (
              <div className="space-y-2">
                {openActions.map((a: any) => (
                  <Card key={a.id}>
                    <CardContent className="py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.due_at && (
                          <span className={`text-xs flex items-center gap-1 ${new Date(a.due_at) < new Date() ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(a.due_at), 'dd/MM')}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
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
              <h2 className="text-lg font-semibold mb-3">Propostas ({proposals.length})</h2>
              <div className="space-y-2">
                {proposals.map((p: any) => (
                  <Card key={p.id}>
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
                ))}
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
                  <Link to={`/crm/visitas/${v.id}`} key={v.id}>
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
    </div>
  );
}
