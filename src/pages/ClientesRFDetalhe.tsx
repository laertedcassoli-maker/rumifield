import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Package, RefreshCcw, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClienteHistoricoTab } from '@/components/crm/ClienteHistoricoTab';
import { PedidoDetalheDialog } from '@/components/clientes-rf/PedidoDetalheDialog';

const TIPO_LABELS: Record<string, string> = {
  envio: 'Envio',
  coleta_reversa: 'Coleta Reversa',
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  solicitado: 'Solicitado',
  processamento: 'Em processamento',
  faturado: 'Faturado',
  enviado: 'Enviado',
  entregue: 'Entregue',
  pendente: 'Pendente',
};

/** Tela somente leitura: dados básicos do cliente, serviços técnicos e envios/coleta reversa. */
export default function ClientesRFDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tipoFilter, setTipoFilter] = useState<'all' | 'envio' | 'coleta_reversa'>('all');
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<string | null>(null);

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['clientes-rf-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: pedidos = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ['clientes-rf-detalhe-pedidos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, pedido_code, tipo_solicitacao, status, created_at, codigo_rastreio, codigo_postagem')
        .eq('cliente_id', id!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const pedidoIds = useMemo(() => pedidos.map((p: any) => p.id), [pedidos]);

  // Data em que cada pedido virou "entregue" (histórico gravado pelo banco).
  const { data: entregueEm = {} } = useQuery({
    queryKey: ['clientes-rf-detalhe-entregue', pedidoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedido_status_history')
        .select('pedido_id, changed_at')
        .in('pedido_id', pedidoIds)
        .eq('status', 'entregue')
        .order('changed_at', { ascending: false });
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const row of data ?? []) {
        if (!mapa[row.pedido_id]) mapa[row.pedido_id] = row.changed_at;
      }
      return mapa;
    },
    enabled: pedidoIds.length > 0,
  });

  const pedidosFiltrados = useMemo(
    () => tipoFilter === 'all'
      ? pedidos
      : pedidos.filter(pedido => pedido.tipo_solicitacao === tipoFilter),
    [pedidos, tipoFilter],
  );

  return (
    <div className="space-y-4 animate-fade-in pb-24 overflow-x-hidden">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate('/clientes-rf')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {loadingCliente ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="space-y-1">
          <h1 className="text-lg font-bold truncate">{cliente?.nome ?? 'Cliente não encontrado'}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {cliente?.fazenda || 'Fazenda não informada'}
          </p>
          {cliente?.cidade && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {cliente.cidade}
              {cliente.estado ? `/${cliente.estado}` : ''}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 items-start">
        <section className="space-y-2 min-w-0">
          <h2 className="text-sm font-semibold">Serviços Técnicos</h2>
          {id && <ClienteHistoricoTab clientId={id} />}
        </section>

        <section className="space-y-2 min-w-0">
          <h2 className="text-sm font-semibold">Envios/Coleta Reversa</h2>
          <Card>
            <CardHeader className="pb-2 space-y-3">
              <CardTitle className="text-base">Histórico de solicitações</CardTitle>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  variant={tipoFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setTipoFilter('all')}
                  className="h-7 text-xs"
                >
                  Todos
                </Button>
                <Button
                  variant={tipoFilter === 'envio' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipoFilter(tipoFilter === 'envio' ? 'all' : 'envio')}
                  className="h-7 text-xs gap-1"
                >
                  <Truck className="h-3 w-3" />
                  Envios
                </Button>
                <Button
                  variant={tipoFilter === 'coleta_reversa' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipoFilter(tipoFilter === 'coleta_reversa' ? 'all' : 'coleta_reversa')}
                  className="h-7 text-xs gap-1"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Coleta Reversa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
            {loadingPedidos ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pedidosFiltrados.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhum envio ou coleta reversa registrado
              </p>
            ) : (
              <div className="space-y-3">
                {pedidosFiltrados.map((p: any) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setPedidoSelecionadoId(p.id)}
                    className="h-auto w-full justify-start gap-3 rounded-none border-b px-0 pb-3 pt-0 text-left last:border-0 last:pb-0"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {p.tipo_solicitacao === 'coleta_reversa' ? (
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {p.pedido_code || 'Sem código'}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {TIPO_LABELS[p.tipo_solicitacao] ?? p.tipo_solicitacao ?? 'Tipo não informado'}
                        {' · '}
                        {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      {(p.codigo_rastreio || p.codigo_postagem) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.codigo_rastreio ? `Rastreio: ${p.codigo_rastreio}` : ''}
                          {p.codigo_rastreio && p.codigo_postagem ? ' · ' : ''}
                          {p.codigo_postagem ? `Postagem: ${p.codigo_postagem}` : ''}
                        </p>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        </section>
      </div>

      <PedidoDetalheDialog
        pedidoId={pedidoSelecionadoId}
        open={!!pedidoSelecionadoId}
        onOpenChange={open => {
          if (!open) setPedidoSelecionadoId(null);
        }}
      />
    </div>
  );
}
