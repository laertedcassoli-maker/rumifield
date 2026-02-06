import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePipelineData, PRODUCT_ORDER, PRODUCT_LABELS, STAGE_LABELS, STAGE_COLORS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ChevronRight, Clock } from 'lucide-react';

const PIPELINE_STAGES: CrmStage[] = ['nao_qualificado', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'];

export default function CrmPipeline() {
  const { clientProducts, lossReasons, consultores, isLoading, isAdmin } = usePipelineData();
  const [selectedProduct, setSelectedProduct] = useState<ProductCode>('ideagri');
  const [selectedConsultor, setSelectedConsultor] = useState<string>('all');

  const filteredByProduct = useMemo(() => {
    let list = clientProducts.filter((p: any) => p.product_code === selectedProduct);
    if (selectedConsultor !== 'all') {
      list = list.filter((p: any) => p.clientes?.consultor_rplus_id === selectedConsultor);
    }
    return list;
  }, [clientProducts, selectedProduct, selectedConsultor]);

  const stageGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    PIPELINE_STAGES.forEach(s => { groups[s] = []; });
    filteredByProduct.forEach((p: any) => {
      if (groups[p.stage]) groups[p.stage].push(p);
    });
    return groups;
  }, [filteredByProduct]);

  // Stats
  const avgDays = (stage: CrmStage) => {
    const items = stageGroups[stage];
    if (items.length === 0) return 0;
    const now = Date.now();
    const total = items.reduce((s: number, p: any) => {
      return s + (now - new Date(p.stage_updated_at).getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(total / items.length);
  };

  // Top loss reasons
  const topLoss = useMemo(() => {
    const reasonCounts: Record<string, number> = {};
    (stageGroups['perdido'] || []).forEach((p: any) => {
      if (p.loss_reason_id) {
        reasonCounts[p.loss_reason_id] = (reasonCounts[p.loss_reason_id] || 0) + 1;
      }
    });
    return Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        reason: lossReasons.find((r: any) => r.id === id)?.reason || 'Outro',
        count,
      }));
  }, [stageGroups, lossReasons]);

  // Consultor summary
  const consultorSummary = useMemo(() => {
    if (!isAdmin) return [];
    const map: Record<string, { nome: string; total: number; opps: number; ganho: number; perdido: number }> = {};
    clientProducts.filter((p: any) => p.product_code === selectedProduct).forEach((p: any) => {
      const cId = p.clientes?.consultor_rplus_id;
      if (!cId) return;
      if (!map[cId]) {
        const c = consultores.find((c: any) => c.id === cId);
        map[cId] = { nome: c?.nome || 'N/A', total: 0, opps: 0, ganho: 0, perdido: 0 };
      }
      map[cId].total++;
      if (['proposta', 'negociacao'].includes(p.stage)) map[cId].opps++;
      if (p.stage === 'ganho') map[cId].ganho++;
      if (p.stage === 'perdido') map[cId].perdido++;
    });
    return Object.values(map).sort((a, b) => b.opps - a.opps);
  }, [clientProducts, selectedProduct, consultores, isAdmin]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Pipeline CRM</h1>
        <p className="text-muted-foreground">Gestão de oportunidades por produto</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v as ProductCode)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRODUCT_ORDER.map(p => (
              <SelectItem key={p} value={p}>{PRODUCT_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Consultor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos consultores</SelectItem>
              {consultores.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          {isAdmin && <TabsTrigger value="consultores">Por Consultor</TabsTrigger>}
          <TabsTrigger value="stats">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          {/* Stage counts */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {PIPELINE_STAGES.map(s => (
              <Card key={s}>
                <CardContent className="py-2 text-center">
                  <p className="text-xl font-bold">{stageGroups[s]?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{STAGE_LABELS[s]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Kanban-style columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage} className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className={`text-[10px] ${STAGE_COLORS[stage]}`}>{STAGE_LABELS[stage]}</Badge>
                  <span className="text-xs text-muted-foreground">({stageGroups[stage]?.length || 0})</span>
                </div>
                {(stageGroups[stage] || []).map((p: any) => (
                  <Link key={p.id} to={`/crm/${p.client_id}`}>
                    <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                      <CardContent className="py-2 px-3">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium truncate">{p.clientes?.nome}</p>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                        {p.clientes?.cidade && (
                          <p className="text-[10px] text-muted-foreground truncate">{p.clientes.cidade}</p>
                        )}
                        {p.value_estimated && (
                          <p className="text-[10px] font-medium mt-0.5">R$ {Number(p.value_estimated).toLocaleString('pt-BR')}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="consultores" className="mt-4">
            <div className="space-y-2">
              {consultorSummary.map((c, i) => (
                <Card key={i}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <span className="font-medium text-sm">{c.nome}</span>
                    <div className="flex gap-3 text-xs">
                      <span>{c.total} clientes</span>
                      <span className="text-amber-600">{c.opps} opps</span>
                      <span className="text-green-600">{c.ganho} ganhos</span>
                      <span className="text-red-600">{c.perdido} perdidos</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {consultorSummary.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="stats" className="mt-4 space-y-4">
          {/* Aging */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Aging Médio (dias)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['proposta', 'negociacao'] as CrmStage[]).map(s => (
                  <div key={s} className="text-center">
                    <p className="text-2xl font-bold">{avgDays(s)}</p>
                    <p className="text-xs text-muted-foreground">{STAGE_LABELS[s]}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top loss reasons */}
          {topLoss.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Top Motivos de Perda</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topLoss.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{l.reason}</span>
                      <Badge variant="outline">{l.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
