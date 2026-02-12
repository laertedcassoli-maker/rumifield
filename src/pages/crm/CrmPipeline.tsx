import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePipelineData, STAGE_LABELS, STAGE_COLORS, PRODUCT_LABELS, PRODUCT_ORDER, type CrmStage, type ProductCode } from '@/hooks/useCrmData';
import { ProductBadge } from '@/components/crm/ProductBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, MapPin, DollarSign } from 'lucide-react';

const PIPELINE_STAGES: CrmStage[] = ['nao_qualificado', 'qualificado', 'em_negociacao', 'ganho', 'perdido'];

export default function CrmPipeline() {
  const { clientProducts, consultores, isLoading, isAdmin } = usePipelineData();
  const [selectedConsultor, setSelectedConsultor] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

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

      {/* Stage counts */}
      <div className="grid grid-cols-5 gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PIPELINE_STAGES.map(stage => (
          <div key={stage} className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Badge className={`text-[10px] ${STAGE_COLORS[stage]}`}>{STAGE_LABELS[stage]}</Badge>
              <span className="text-xs text-muted-foreground">({stageGroups[stage]?.length || 0})</span>
            </div>
            {(stageGroups[stage] || []).map((p: any) => (
              <Link key={p.id} to={`/crm/${p.client_id}`} state={{ from: '/crm/pipeline', fromLabel: 'Pipeline' }}>
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                  <CardContent className="py-2.5 px-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <ProductBadge productCode={p.product_code} className="text-[10px] px-1.5 py-0" />
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
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
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
