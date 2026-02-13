import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipelineData, STAGE_LABELS, STAGE_COLORS, PRODUCT_LABELS, PRODUCT_ORDER, type CrmStage, type ProductCode } from '@/hooks/useCrmData';
import { ProductBadge } from '@/components/crm/ProductBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { OpportunityTimeline } from '@/components/crm/OpportunityTimeline';
import { ChevronRight, MapPin, DollarSign, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STAGES: CrmStage[] = ['nao_qualificado', 'qualificado', 'em_negociacao', 'ganho', 'perdido'];

export default function CrmPipeline() {
  const navigate = useNavigate();
  const { clientProducts, consultores, isLoading, isAdmin, lastInteractionByProduct } = usePipelineData();
  const [selectedConsultor, setSelectedConsultor] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  

  const filtered = useMemo(() => {
    let list = clientProducts;
    if (selectedConsultor !== 'all') {
      list = list.filter((p: any) => p.clientes?.consultor_rplus_id === selectedConsultor);
    }
    if (selectedProduct !== 'all') {
      list = list.filter((p: any) => p.product_code === selectedProduct);
    }
    return list;
  }, [clientProducts, selectedConsultor, selectedProduct]);

  const stageGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    PIPELINE_STAGES.forEach(s => { groups[s] = []; });
    filtered.forEach((p: any) => {
      if (groups[p.stage]) groups[p.stage].push(p);
    });
    return groups;
  }, [filtered]);

  const stageTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => {
      totals[s] = (stageGroups[s] || []).reduce((sum: number, p: any) => sum + (Number(p.value_estimated) || 0), 0);
    });
    return totals;
  }, [stageGroups]);

  const getDaysSince = (productId: string): number | null => {
    const last = lastInteractionByProduct[productId];
    if (!last) return null;
    return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toLocaleString('pt-BR')}`;
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div>
        <h1 className="text-xl font-bold">Pipeline CRM</h1>
        <p className="text-sm text-muted-foreground">Gestão de oportunidades</p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {isAdmin && (
          <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Consultor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos consultores</SelectItem>
              {consultores.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={selectedProduct === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedProduct('all')}
          >
            Todos
          </Button>
          {PRODUCT_ORDER.map(code => (
            <Button
              key={code}
              size="sm"
              variant={selectedProduct === code ? 'default' : 'outline'}
              onClick={() => setSelectedProduct(code)}
            >
              {PRODUCT_LABELS[code]}
            </Button>
          ))}
        </div>
      </div>

      {/* Stage counts + totals */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PIPELINE_STAGES.map(s => (
          <Card key={s} className="min-w-[90px] flex-shrink-0 flex-1">
            <CardContent className="py-2 px-2 text-center">
              <p className="text-xl font-bold">{stageGroups[s]?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground">{STAGE_LABELS[s]}</p>
              {stageTotals[s] > 0 && (
                <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                  {formatCurrency(stageTotals[s])}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PIPELINE_STAGES.map(stage => (
          <div key={stage} className="space-y-2">
            {(stageGroups[stage] || []).map((p: any) => {
              const daysSince = getDaysSince(p.id);
              const isCold = daysSince !== null && daysSince > 15;
              const noInteractions = daysSince === null && p.stage !== 'nao_qualificado';

              return (
                <div key={p.id} className="cursor-pointer" onClick={() => navigate(`/crm/${p.client_id}`, { state: { from: '/crm/pipeline', fromLabel: 'Pipeline' } })}>
                  <Card className={cn(
                    "hover:bg-accent/30 transition-colors cursor-pointer",
                    (isCold || noInteractions) && "border-destructive/40"
                  )}>
                    <CardContent className="py-2.5 px-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <ProductBadge productCode={p.product_code} className="text-[10px] px-1.5 py-0" />
                        <div className="flex items-center gap-1">
                          {(isCold || noInteractions) && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                              {daysSince !== null ? `${daysSince}d` : '!'}
                            </Badge>
                          )}
                          <Popover
                            open={openPopoverId === p.id}
                            onOpenChange={(open) => setOpenPopoverId(open ? p.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="p-0.5 rounded hover:bg-accent transition-colors"
                                title="Ver interações"
                              >
                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[min(320px,calc(100vw-32px))] max-h-96 overflow-y-auto p-3"
                              align="end"
                              side="bottom"
                              collisionPadding={16}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex-1" />
                                <button
                                  onClick={() => setOpenPopoverId(null)}
                                  className="p-1 rounded hover:bg-accent transition-colors"
                                  title="Fechar"
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                              <OpportunityTimeline
                                clientProductId={p.id}
                                clientId={p.client_id}
                                stage={p.stage}
                                stageUpdatedAt={p.stage_updated_at}
                              />
                            </PopoverContent>
                          </Popover>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                      <p className="text-xs font-medium truncate">{p.clientes?.nome}</p>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        {p.clientes?.cidade ? (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {p.clientes.cidade}
                          </span>
                        ) : <span />}
                        {p.value_estimated && (
                          <span className="flex items-center gap-0.5 font-medium text-foreground shrink-0">
                            <DollarSign className="h-2.5 w-2.5" />
                            {Number(p.value_estimated).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {openPopoverId && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpenPopoverId(null)}
        />
      )}
    </div>
  );
}
