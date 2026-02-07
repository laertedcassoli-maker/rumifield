import { Badge } from '@/components/ui/badge';
import { ProductBadge } from '@/components/crm/ProductBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleDot, Heart, TrendingUp, FileText, RefreshCw, Eye, ClipboardCheck } from 'lucide-react';
import {
  PRODUCT_LABELS, STAGE_LABELS, STAGE_COLORS, HEALTH_COLORS,
  type ProductCode, type CrmStage,
} from '@/hooks/useCrmData';

interface Props {
  productCode: ProductCode;
  stage: CrmStage;
  snapshot?: any;
  metricDefs: any[];
  lossReasons: any[];
  lossReasonId?: string | null;
  lossNotes?: string | null;
  readOnly?: boolean;
  onQualify: () => void;
  onCreateProposal: () => void;
  onUpdateNegotiation: () => void;
  onViewDetails?: () => void;
}

export function ProductCard({
  productCode, stage, snapshot, metricDefs, lossReasons,
  lossReasonId, lossNotes, readOnly,
  onQualify, onCreateProposal, onUpdateNegotiation, onViewDetails,
}: Props) {
  const healthStatus = snapshot?.health_status;
  const healthReasons: string[] = snapshot?.health_reasons || [];
  const snapshotData = snapshot?.data || {};

  const productMetrics = metricDefs
    .filter(m => m.product_code === productCode)
    .slice(0, 6);

  const renderMetricValue = (metric: any) => {
    const val = snapshotData[metric.metric_key];
    if (val === undefined || val === null) return <span className="text-muted-foreground">—</span>;
    
    switch (metric.value_type) {
      case 'currency':
        return <span>R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>;
      case 'percent':
        return <span>{val}%</span>;
      case 'status':
        return <Badge variant="outline" className="text-[10px]">{String(val)}</Badge>;
      case 'date':
        return <span>{val}</span>;
      default:
        return <span>{String(val)}</span>;
    }
  };

  const ctaButton = (() => {
    switch (stage) {
      case 'nao_qualificado':
        return <Button size="sm" onClick={onQualify} className="gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> Qualificar</Button>;
      case 'qualificado':
        return <Button size="sm" onClick={onCreateProposal} className="gap-1"><FileText className="h-3.5 w-3.5" /> Criar proposta</Button>;
      case 'proposta':
        return <Button size="sm" variant="outline" onClick={onUpdateNegotiation} className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Atualizar negociação</Button>;
      case 'negociacao':
        return <Button size="sm" variant="outline" onClick={onUpdateNegotiation} className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Ganho/Perdido</Button>;
      case 'ganho':
        return <Button size="sm" variant="ghost" onClick={onViewDetails} className="gap-1"><Eye className="h-3.5 w-3.5" /> Ver detalhes</Button>;
      case 'perdido':
      case 'descartado':
        return <Button size="sm" variant="ghost" onClick={onUpdateNegotiation} className="gap-1"><RefreshCw className="h-3.5 w-3.5" /> Reabrir</Button>;
      default:
        return null;
    }
  })();

  const lossReason = lossReasonId ? lossReasons.find(r => r.id === lossReasonId) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <ProductBadge productCode={productCode} className="text-xs px-2 py-0.5" />
        <div className="flex items-center gap-2">
          {healthStatus && (
            <CircleDot className={`h-4 w-4 ${HEALTH_COLORS[healthStatus] || 'text-muted-foreground'}`} />
          )}
          <Badge className={`text-[10px] ${STAGE_COLORS[stage]}`}>{STAGE_LABELS[stage]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Health reasons */}
        {healthReasons.length > 0 && (
          <div className="space-y-1">
            {healthReasons.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <Heart className={`h-3 w-3 mt-0.5 shrink-0 ${HEALTH_COLORS[healthStatus || ''] || 'text-muted-foreground'}`} />
                <span className="text-muted-foreground">{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Metrics */}
        {productMetrics.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {productMetrics.map(m => (
              <div key={m.id} className="flex justify-between gap-1">
                <span className="text-muted-foreground truncate">{m.label}</span>
                <span className="font-medium shrink-0">{renderMetricValue(m)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Loss reason */}
        {(stage === 'perdido' || stage === 'descartado') && lossReason && (
          <div className="text-xs p-2 rounded bg-red-50 dark:bg-red-900/20 space-y-0.5">
            <span className="font-medium text-red-700 dark:text-red-400">Motivo: {lossReason.reason}</span>
            {lossNotes && <p className="text-muted-foreground">{lossNotes}</p>}
          </div>
        )}

        {/* CTA */}
        {!readOnly && <div className="flex justify-end pt-1">{ctaButton}</div>}
      </CardContent>
    </Card>
  );
}
