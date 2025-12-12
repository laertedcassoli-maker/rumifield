import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Package, ClipboardCheck, TrendingDown, Calendar, Droplets, Users, FlaskConical } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Product styling configuration
const productStyles = [
  { 
    icon: Droplets, 
    activeClass: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    inactiveClass: 'text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
  },
  { 
    icon: FlaskConical, 
    activeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    inactiveClass: 'text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400'
  },
];

type TimelineEventType = 'envio' | 'afericao' | 'consumo';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: Date;
  data: {
    quantidade?: number;
    galoes?: number;
    galoes_cheios?: number;
    nivel_galao_parcial?: number;
    vacas_lactacao?: number;
    consumo?: number;
    orcado?: number;
    desvio_percentual?: number;
    periodo_dias?: number;
  };
}

export default function Historico() {
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [selectedProduto, setSelectedProduto] = useState<string>('');

  // Fetch active clients
  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, data_ativacao_rumiflow')
        .eq('status', 'ativo');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active products
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_quimicos')
        .select('id, nome, litros_por_vaca_mes')
        .eq('ativo', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch shipments for selected client and product
  const { data: envios, isLoading: loadingEnvios } = useQuery({
    queryKey: ['envios-historico', selectedCliente, selectedProduto],
    queryFn: async () => {
      if (!selectedCliente || !selectedProduto) return [];
      const { data, error } = await supabase
        .from('envios_produtos')
        .select('id, quantidade, galoes, data_envio')
        .eq('cliente_id', selectedCliente)
        .eq('produto_id', selectedProduto)
        .order('data_envio', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCliente && !!selectedProduto,
  });

  // Fetch stock measurements for selected client and product
  const { data: afericoes, isLoading: loadingAfericoes } = useQuery({
    queryKey: ['afericoes-historico', selectedCliente, selectedProduto],
    queryFn: async () => {
      if (!selectedCliente || !selectedProduto) return [];
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select('id, galoes_cheios, nivel_galao_parcial, vacas_lactacao, data_afericao')
        .eq('cliente_id', selectedCliente)
        .eq('produto_id', selectedProduto)
        .order('data_afericao', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCliente && !!selectedProduto,
  });

  // Get product litros_por_vaca_mes
  const produtoSelecionado = produtos?.find(p => p.id === selectedProduto);
  const clienteSelecionado = clientes?.find(c => c.id === selectedCliente);

  // Build timeline with events
  const timelineEvents = useMemo(() => {
    if (!envios || !afericoes) return [];

    const events: TimelineEvent[] = [];

    // Add shipment events
    envios.forEach(envio => {
      events.push({
        id: `envio-${envio.id}`,
        type: 'envio',
        date: new Date(envio.data_envio),
        data: {
          quantidade: Number(envio.quantidade),
          galoes: envio.galoes,
        },
      });
    });

    // Add measurement events and calculate consumption
    afericoes.forEach((afericao, index) => {
      const currentDate = new Date(afericao.data_afericao);
      const currentStock = (afericao.galoes_cheios * 50) + ((afericao.nivel_galao_parcial || 0) / 100 * 50);

      events.push({
        id: `afericao-${afericao.id}`,
        type: 'afericao',
        date: currentDate,
        data: {
          galoes_cheios: afericao.galoes_cheios,
          nivel_galao_parcial: afericao.nivel_galao_parcial,
          vacas_lactacao: afericao.vacas_lactacao,
        },
      });

      // Calculate consumption between measurements
      let consumo = 0;
      let periodoInicio: Date;
      let estoqueInicial = 0;

      if (index === 0) {
        // First measurement - use activation date as start
        if (clienteSelecionado?.data_ativacao_rumiflow) {
          periodoInicio = new Date(clienteSelecionado.data_ativacao_rumiflow);
        } else {
          return; // Can't calculate without activation date
        }
        // Initial stock is sum of shipments up to this measurement
        estoqueInicial = envios
          .filter(e => new Date(e.data_envio) <= currentDate)
          .reduce((sum, e) => sum + Number(e.quantidade), 0);
      } else {
        // Subsequent measurements - use previous measurement as start
        const prevAfericao = afericoes[index - 1];
        periodoInicio = new Date(prevAfericao.data_afericao);
        const prevStock = (prevAfericao.galoes_cheios * 50) + ((prevAfericao.nivel_galao_parcial || 0) / 100 * 50);
        
        // Add shipments between measurements
        const enviosNoPeriodo = envios
          .filter(e => {
            const envioDate = new Date(e.data_envio);
            return envioDate > periodoInicio && envioDate <= currentDate;
          })
          .reduce((sum, e) => sum + Number(e.quantidade), 0);

        estoqueInicial = prevStock + enviosNoPeriodo;
      }

      consumo = estoqueInicial - currentStock;
      const periodoDias = differenceInDays(currentDate, periodoInicio);
      
      if (periodoDias > 0 && afericao.vacas_lactacao && produtoSelecionado?.litros_por_vaca_mes) {
        const orcadoDiario = (afericao.vacas_lactacao * Number(produtoSelecionado.litros_por_vaca_mes)) / 30;
        const orcado = orcadoDiario * periodoDias;
        const desvioPercentual = orcado > 0 ? ((consumo - orcado) / orcado) * 100 : 0;

        events.push({
          id: `consumo-${afericao.id}`,
          type: 'consumo',
          date: currentDate,
          data: {
            consumo: Math.round(consumo * 10) / 10,
            orcado: Math.round(orcado * 10) / 10,
            desvio_percentual: Math.round(desvioPercentual * 10) / 10,
            periodo_dias: periodoDias,
          },
        });
      }
    });

    // Sort by date descending (most recent first)
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [envios, afericoes, produtoSelecionado, clienteSelecionado]);

  const isLoading = loadingClientes || loadingProdutos || loadingEnvios || loadingAfericoes;

  const getDesvioColor = (desvio: number) => {
    if (desvio <= 0) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (desvio <= 20) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getDesvioIcon = (desvio: number) => {
    if (desvio <= 0) return '✅';
    if (desvio <= 20) return '⚠️';
    return '🔴';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
        <p className="text-muted-foreground">Timeline de envios, aferições e consumo</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fazenda</label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma fazenda" />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.fazenda || cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Produto</label>
              <div className="flex gap-2">
                {produtos?.map((produto, index) => {
                  const style = productStyles[index % productStyles.length];
                  const Icon = style.icon;
                  const isSelected = selectedProduto === produto.id;
                  
                  return (
                    <Button
                      key={produto.id}
                      variant="outline"
                      onClick={() => setSelectedProduto(produto.id)}
                      disabled={loadingProdutos}
                      className={cn(
                        "gap-2 transition-all duration-200 flex-1",
                        isSelected ? style.activeClass : style.inactiveClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {produto.nome}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {!selectedCliente || !selectedProduto ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Selecione uma fazenda e um produto para visualizar o histórico
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : timelineEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum registro encontrado para esta fazenda e produto
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {timelineEvents.map((event, index) => (
              <div
                key={event.id}
                className="relative pl-14 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    event.type === 'envio'
                      ? 'bg-blue-500/20 border-blue-500'
                      : event.type === 'afericao'
                      ? 'bg-green-500/20 border-green-500'
                      : 'bg-orange-500/20 border-orange-500'
                  }`}
                >
                  {event.type === 'envio' && <Package className="h-2.5 w-2.5 text-blue-400" />}
                  {event.type === 'afericao' && <ClipboardCheck className="h-2.5 w-2.5 text-green-400" />}
                  {event.type === 'consumo' && <TrendingDown className="h-2.5 w-2.5 text-orange-400" />}
                </div>

                {/* Event card */}
                {event.type === 'envio' && (
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-400" />
                          Envio
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(event.date, "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Droplets className="h-4 w-4 text-blue-400" />
                          <span className="font-medium">{event.data.quantidade} L</span>
                        </div>
                        <div className="text-muted-foreground">
                          ({event.data.galoes} galões)
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {event.type === 'afericao' && (
                  <Card className="border-green-500/30 bg-green-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-green-400" />
                          Aferição
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(event.date, "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div>
                          <span className="font-medium">{event.data.galoes_cheios} galões cheios</span>
                          {event.data.nivel_galao_parcial && event.data.nivel_galao_parcial > 0 && (
                            <span className="text-muted-foreground"> + {event.data.nivel_galao_parcial}%</span>
                          )}
                        </div>
                        {event.data.vacas_lactacao && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {event.data.vacas_lactacao} vacas
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {event.type === 'consumo' && (
                  <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-orange-400" />
                          Consumo no Período
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {event.data.periodo_dias} dias
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Realizado:</span>{' '}
                          <span className="font-medium">{event.data.consumo} L</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Orçado:</span>{' '}
                          <span className="font-medium">{event.data.orcado} L</span>
                        </div>
                        <Badge className={`${getDesvioColor(event.data.desvio_percentual || 0)}`}>
                          {getDesvioIcon(event.data.desvio_percentual || 0)}{' '}
                          {event.data.desvio_percentual! > 0 ? '+' : ''}
                          {event.data.desvio_percentual}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
