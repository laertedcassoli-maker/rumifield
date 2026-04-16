import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, HandHelping, FileText, Eye, ArrowRight, CheckCircle2, 
  User, Calendar, Package, Clock, AlertTriangle 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ConcluirPedidoDialog from './ConcluirPedidoDialog';
import ProcessarPedidoDialog from './ProcessarPedidoDialog';
import type { PedidoComItens } from '@/types/pedidos';

const urgenciaConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const origemConfig: Record<string, { label: string; className: string }> = {
  chamado: { label: 'Chamado', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  preventiva: { label: 'Preventiva', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  corretiva: { label: 'Corretiva', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

const tipoEnvioConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  envio_fisico: { label: 'Envio Físico', icon: <Truck className="h-3 w-3" />, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  apenas_nf: { label: 'Apenas NF', icon: <FileText className="h-3 w-3" />, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const tipoLogisticaConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  correios: { label: 'Correios', icon: <Truck className="h-3 w-3" />, className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  entrega_propria: { label: 'Entrega Própria', icon: <HandHelping className="h-3 w-3" />, className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
};

interface PedidoKanbanProps {
  pedidos: PedidoComItens[];
  onViewPedido: (pedido: PedidoComItens) => void;
  onProcessar: (pedidoId: string, tipoLogistica?: string, itemsWithAssets?: Record<string, string[]>) => Promise<void>;
  onConcluir: (pedidoId: string, nfNumero: string, dataFaturamento: string, tipoLogistica: string, itemsWithAssets?: Record<string, string[]>, nfNumero2?: string) => Promise<void>;
  isProcessing: boolean;
  consultorNames: Record<string, string>;
}

function PedidoCard({ 
  pedido, 
  onView, 
  actionButton 
}: { 
  pedido: PedidoComItens; 
  onView: () => void;
  actionButton?: React.ReactNode;
}) {
  const urgencia = urgenciaConfig[pedido.urgencia || 'normal'] || urgenciaConfig.normal;
  const origem = pedido.origem ? origemConfig[pedido.origem] : null;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        {/* Pedido code */}
        {pedido.pedido_code && (
          <span className="font-mono text-xs text-muted-foreground">{pedido.pedido_code}</span>
        )}
        {/* Top badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={cn('text-[10px] h-5 border-0', urgencia.className)}>
            {urgencia.label}
          </Badge>
          {origem && (
            <Badge variant="outline" className={cn('text-[10px] h-5 border-0', origem.className)}>
              {origem.label}
            </Badge>
          )}
          {pedido.tipo_envio && tipoEnvioConfig[pedido.tipo_envio] && (
            <Badge variant="outline" className={cn('text-[10px] h-5 border-0 gap-0.5', tipoEnvioConfig[pedido.tipo_envio].className)}>
              {tipoEnvioConfig[pedido.tipo_envio].icon}
              {tipoEnvioConfig[pedido.tipo_envio].label}
            </Badge>
          )}
          {pedido.tipo_logistica && tipoLogisticaConfig[pedido.tipo_logistica] && (
            <Badge variant="outline" className={cn('text-[10px] h-5 border-0 gap-0.5', tipoLogisticaConfig[pedido.tipo_logistica].className)}>
              {tipoLogisticaConfig[pedido.tipo_logistica].icon}
              {tipoLogisticaConfig[pedido.tipo_logistica].label}
            </Badge>
          )}
        </div>

        {/* Client */}
        <div>
          <p className="font-medium text-sm leading-tight">{pedido.clientes?.nome}</p>
          {pedido.clientes?.fazenda && (
            <p className="text-xs text-muted-foreground">{pedido.clientes.fazenda}</p>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            <span>{pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0} peças, {pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.reduce((s: number, i: any) => s + i.quantidade, 0) || 0} un</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(pedido.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
          </div>
          {pedido.solicitante && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate">{pedido.solicitante.nome}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1 gap-1" onClick={onView}>
            <Eye className="h-3 w-3" />
            Detalhes
          </Button>
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PedidoKanban({ 
  pedidos, onViewPedido, onProcessar, onConcluir, isProcessing, consultorNames 
}: PedidoKanbanProps) {
  const [concluirPedidoId, setConcluirPedidoId] = useState<string | null>(null);
  const [processarPedidoId, setProcessarPedidoId] = useState<string | null>(null);

  const abertos = pedidos.filter(p => p.status === 'solicitado');
  const emProcessamento = pedidos.filter(p => p.status === 'processamento');
  const concluidos = pedidos.filter(p => p.status === 'faturado');

  const columns = [
    {
      title: 'Aberto',
      count: abertos.length,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      items: abertos,
      renderAction: (pedido: PedidoComItens) => (
        <Button
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={() => setProcessarPedidoId(pedido.id)}
          disabled={isProcessing}
        >
          <ArrowRight className="h-3 w-3" />
          Processar
        </Button>
      ),
    },
    {
      title: 'Em Processamento',
      count: emProcessamento.length,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      items: emProcessamento,
      renderAction: (pedido: PedidoComItens) => (
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1 gap-1 bg-green-600 hover:bg-green-700"
          onClick={() => setConcluirPedidoId(pedido.id)}
          disabled={isProcessing}
        >
          <CheckCircle2 className="h-3 w-3" />
          Concluir
        </Button>
      ),
    },
    {
      title: 'Concluído',
      count: concluidos.length,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      items: concluidos,
      renderAction: undefined,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col.title} className="space-y-3">
            <div className={cn('rounded-lg p-3', col.bgColor)}>
              <h3 className={cn('font-semibold text-sm flex items-center gap-2', col.color)}>
                {col.title}
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{col.count}</Badge>
              </h3>
            </div>
            <div className="space-y-2">
              {col.items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido</p>
              ) : (
                col.items.map(pedido => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    onView={() => onViewPedido(pedido)}
                    actionButton={col.renderAction?.(pedido)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <ConcluirPedidoDialog
        open={!!concluirPedidoId}
        onOpenChange={(open) => !open && setConcluirPedidoId(null)}
        pedido={concluirPedidoId ? pedidos.find(p => p.id === concluirPedidoId) : undefined}
        currentTipoLogistica={concluirPedidoId ? pedidos.find(p => p.id === concluirPedidoId)?.tipo_logistica : undefined}
        onConfirm={async (nfNumero, dataFaturamento, tipoLogistica, itemsWithAssets, nfNumero2) => {
          if (concluirPedidoId) {
            await onConcluir(concluirPedidoId, nfNumero, dataFaturamento, tipoLogistica, itemsWithAssets, nfNumero2);
            setConcluirPedidoId(null);
          }
        }}
      />

      <ProcessarPedidoDialog
        open={!!processarPedidoId}
        onOpenChange={(open) => !open && setProcessarPedidoId(null)}
        pedido={processarPedidoId ? pedidos.find(p => p.id === processarPedidoId) : undefined}
        onConfirm={async (tipoLogistica, itemsWithAssets) => {
          if (processarPedidoId) {
            await onProcessar(processarPedidoId, tipoLogistica, itemsWithAssets);
            setProcessarPedidoId(null);
          }
        }}
      />
    </>
  );
}
