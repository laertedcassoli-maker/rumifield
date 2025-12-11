import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Beaker, AlertTriangle, CheckCircle, Users, Calendar, ExternalLink, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DesviosProduto {
  produto_id: string;
  produto_nome: string;
  orcado_litros: number;
  realizado_litros: number;
  desvio_litros: number;
  desvio_percentual: number;
  fazendas_analisadas: number;
}

interface FazendaStatus {
  id: string;
  nome: string;
  fazenda: string | null;
  data_ativacao_rumiflow: string | null;
  status: string;
  ultima_afericao: string | null;
  dias_sem_afericao: number | null;
}

export default function Dashboard() {
  const { profile, role } = useAuth();

  const { data: fazendasStatus, isLoading } = useQuery({
    queryKey: ['dashboard-fazendas-status'],
    queryFn: async () => {
      // Busca clientes ativos
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, data_ativacao_rumiflow, status')
        .eq('status', 'ativo');

      if (clientesError) throw clientesError;

      // Busca última aferição de cada cliente
      const { data: afericoes, error: afericoesError } = await supabase
        .from('estoque_cliente')
        .select('cliente_id, data_afericao')
        .order('data_afericao', { ascending: false });

      if (afericoesError) throw afericoesError;

      // Agrupa última aferição por cliente
      const ultimaAfericaoPorCliente: Record<string, string> = {};
      afericoes?.forEach(af => {
        if (!ultimaAfericaoPorCliente[af.cliente_id]) {
          ultimaAfericaoPorCliente[af.cliente_id] = af.data_afericao;
        }
      });

      const hoje = new Date();

      // Mapeia status de cada fazenda
      const fazendasComStatus: FazendaStatus[] = (clientes || []).map(cliente => {
        const ultimaAfericao = ultimaAfericaoPorCliente[cliente.id] || null;
        let diasSemAfericao: number | null = null;

        if (ultimaAfericao) {
          diasSemAfericao = differenceInDays(hoje, parseISO(ultimaAfericao));
        } else if (cliente.data_ativacao_rumiflow) {
          // Se não tem aferição mas tem data de ativação, conta desde a ativação
          diasSemAfericao = differenceInDays(hoje, parseISO(cliente.data_ativacao_rumiflow));
        }

        return {
          id: cliente.id,
          nome: cliente.nome,
          fazenda: cliente.fazenda,
          data_ativacao_rumiflow: cliente.data_ativacao_rumiflow,
          status: cliente.status,
          ultima_afericao: ultimaAfericao,
          dias_sem_afericao: diasSemAfericao,
        };
      });

      return fazendasComStatus;
    },
  });

  // Query para análise de desvios por produto (mesma lógica do ConsumoTab)
  const { data: desviosProdutos, isLoading: isLoadingDesvios } = useQuery({
    queryKey: ['dashboard-desvios-produtos'],
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const limite30dias = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      // Busca produtos ativos
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos_quimicos')
        .select('id, nome, litros_por_vaca_mes')
        .eq('ativo', true);

      if (produtosError) throw produtosError;

      // Busca clientes com data de ativação
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, data_ativacao_rumiflow')
        .eq('status', 'ativo');

      if (clientesError) throw clientesError;

      // Busca todas as aferições (ordenadas por data)
      const { data: afericoes, error: afericoesError } = await supabase
        .from('estoque_cliente')
        .select('cliente_id, produto_id, galoes_cheios, nivel_galao_parcial, vacas_lactacao, data_afericao')
        .lte('data_afericao', hoje) // Ignora datas futuras!
        .order('data_afericao', { ascending: true });

      if (afericoesError) throw afericoesError;

      // Busca todos os envios
      const { data: envios, error: enviosError } = await supabase
        .from('envios_produtos')
        .select('cliente_id, produto_id, quantidade, data_envio');

      if (enviosError) throw enviosError;

      const LITROS_POR_GALAO = 50;

      const calcularTotalLitros = (galoesCheios: number, nivelParcial: number | null) => {
        const cheios = galoesCheios * LITROS_POR_GALAO;
        const parcial = nivelParcial !== null ? (nivelParcial / 100) * LITROS_POR_GALAO : 0;
        return Math.round(cheios + parcial);
      };

      // Agrupa aferições por cliente e data
      const afericoesPorCliente: Record<string, {
        data_ativacao: string | null;
        afericoes: Array<{
          data: string;
          vacas_lactacao: number | null;
          produtos: Record<string, number>;
        }>;
      }> = {};

      const clientesMap = new Map(clientes?.map(c => [c.id, c]) || []);

      afericoes?.forEach(af => {
        const cliente = clientesMap.get(af.cliente_id);
        if (!afericoesPorCliente[af.cliente_id]) {
          afericoesPorCliente[af.cliente_id] = {
            data_ativacao: cliente?.data_ativacao_rumiflow || null,
            afericoes: [],
          };
        }
        
        const dataKey = af.data_afericao;
        let entry = afericoesPorCliente[af.cliente_id].afericoes.find(e => e.data === dataKey);
        
        if (!entry) {
          entry = { data: dataKey, vacas_lactacao: af.vacas_lactacao, produtos: {} };
          afericoesPorCliente[af.cliente_id].afericoes.push(entry);
        }
        
        if (af.vacas_lactacao !== null) {
          entry.vacas_lactacao = af.vacas_lactacao;
        }
        
        entry.produtos[af.produto_id] = calcularTotalLitros(af.galoes_cheios, af.nivel_galao_parcial);
      });

      // Agrupa envios por cliente/produto
      const enviosPorClienteProduto: Record<string, Record<string, Array<{ data: string; quantidade: number }>>> = {};
      
      envios?.forEach(env => {
        if (!enviosPorClienteProduto[env.cliente_id]) {
          enviosPorClienteProduto[env.cliente_id] = {};
        }
        if (!enviosPorClienteProduto[env.cliente_id][env.produto_id]) {
          enviosPorClienteProduto[env.cliente_id][env.produto_id] = [];
        }
        enviosPorClienteProduto[env.cliente_id][env.produto_id].push({
          data: env.data_envio,
          quantidade: env.quantidade,
        });
      });

      // Calcula consumo entre aferições consecutivas
      interface ConsumoItem {
        cliente_id: string;
        data_inicial: string;
        data_final: string;
        dias_periodo: number;
        vacas_lactacao: number | null;
        produtos: Record<string, { consumo_30dias: number; orcado_30dias: number | null }>;
      }

      const todosConsumos: ConsumoItem[] = [];

      Object.entries(afericoesPorCliente).forEach(([clienteId, clienteData]) => {
        const afs = clienteData.afericoes;
        const dataAtivacao = clienteData.data_ativacao;
        
        // Primeiro registro: usa data de ativação como estoque inicial
        if (afs.length > 0 && dataAtivacao && dataAtivacao < afs[0].data) {
          const primeiraAfericao = afs[0];
          const diasPeriodo = differenceInDays(parseISO(primeiraAfericao.data), parseISO(dataAtivacao));

          const consumoItem: ConsumoItem = {
            cliente_id: clienteId,
            data_inicial: dataAtivacao,
            data_final: primeiraAfericao.data,
            dias_periodo: diasPeriodo,
            vacas_lactacao: primeiraAfericao.vacas_lactacao,
            produtos: {},
          };

          produtos?.forEach(produto => {
            const estoqueFinal = primeiraAfericao.produtos[produto.id] || 0;
            let totalEnvios = 0;
            const enviosProduto = enviosPorClienteProduto[clienteId]?.[produto.id] || [];
            enviosProduto.forEach(env => {
              if (env.data <= primeiraAfericao.data) {
                totalEnvios += env.quantidade;
              }
            });

            const consumo = Math.max(0, totalEnvios - estoqueFinal);
            const consumo30dias = diasPeriodo > 0 ? Math.round((consumo / diasPeriodo) * 30) : 0;
            const orcado30dias = (primeiraAfericao.vacas_lactacao && produto.litros_por_vaca_mes) 
              ? Math.round(primeiraAfericao.vacas_lactacao * produto.litros_por_vaca_mes)
              : null;

            consumoItem.produtos[produto.id] = { consumo_30dias: consumo30dias, orcado_30dias: orcado30dias };
          });

          todosConsumos.push(consumoItem);
        }

        // Aferições consecutivas
        for (let i = 1; i < afs.length; i++) {
          const anterior = afs[i - 1];
          const atual = afs[i];
          const diasPeriodo = differenceInDays(parseISO(atual.data), parseISO(anterior.data));

          const consumoItem: ConsumoItem = {
            cliente_id: clienteId,
            data_inicial: anterior.data,
            data_final: atual.data,
            dias_periodo: diasPeriodo,
            vacas_lactacao: atual.vacas_lactacao,
            produtos: {},
          };

          produtos?.forEach(produto => {
            const estoqueInicial = anterior.produtos[produto.id] || 0;
            const estoqueFinal = atual.produtos[produto.id] || 0;

            let totalEnvios = 0;
            const enviosProduto = enviosPorClienteProduto[clienteId]?.[produto.id] || [];
            enviosProduto.forEach(env => {
              if (env.data > anterior.data && env.data <= atual.data) {
                totalEnvios += env.quantidade;
              }
            });

            const consumo = Math.max(0, estoqueInicial + totalEnvios - estoqueFinal);
            const consumo30dias = diasPeriodo > 0 ? Math.round((consumo / diasPeriodo) * 30) : 0;
            const orcado30dias = (atual.vacas_lactacao && produto.litros_por_vaca_mes) 
              ? Math.round(atual.vacas_lactacao * produto.litros_por_vaca_mes)
              : null;

            consumoItem.produtos[produto.id] = { consumo_30dias: consumo30dias, orcado_30dias: orcado30dias };
          });

          todosConsumos.push(consumoItem);
        }
      });

      // Filtra apenas consumos com data_final nos últimos 30 dias
      const consumosRecentes = todosConsumos.filter(c => c.data_final >= limite30dias && c.data_final <= hoje);

      // Pega apenas o último registro de cada cliente
      const ultimoPorCliente: Record<string, ConsumoItem> = {};
      consumosRecentes.forEach(item => {
        const existing = ultimoPorCliente[item.cliente_id];
        if (!existing || item.data_final > existing.data_final) {
          ultimoPorCliente[item.cliente_id] = item;
        }
      });

      const consumosFinais = Object.values(ultimoPorCliente);

      // Agrega por produto
      const desviosPorProduto: Record<string, { orcado: number; realizado: number; fazendas: Set<string> }> = {};

      consumosFinais.forEach(consumo => {
        Object.entries(consumo.produtos).forEach(([produtoId, dados]) => {
          if (!desviosPorProduto[produtoId]) {
            desviosPorProduto[produtoId] = { orcado: 0, realizado: 0, fazendas: new Set() };
          }
          
          desviosPorProduto[produtoId].realizado += dados.consumo_30dias;
          if (dados.orcado_30dias !== null) {
            desviosPorProduto[produtoId].orcado += dados.orcado_30dias;
          }
          desviosPorProduto[produtoId].fazendas.add(consumo.cliente_id);
        });
      });

      // Formata resultado
      const resultado: DesviosProduto[] = Object.entries(desviosPorProduto)
        .map(([produtoId, dados]) => {
          const produto = produtos?.find(p => p.id === produtoId);
          const desvioLitros = dados.realizado - dados.orcado;
          const desvioPercentual = dados.orcado > 0 ? (desvioLitros / dados.orcado) * 100 : 0;

          return {
            produto_id: produtoId,
            produto_nome: produto?.nome || 'Desconhecido',
            orcado_litros: dados.orcado,
            realizado_litros: dados.realizado,
            desvio_litros: desvioLitros,
            desvio_percentual: Math.round(desvioPercentual * 10) / 10,
            fazendas_analisadas: dados.fazendas.size,
          };
        })
        .filter(d => d.fazendas_analisadas > 0);

      return resultado;
    },
  });

  // Filtra fazendas que precisam de atenção (sem aferição há +30 dias)
  const fazendasAtencao = fazendasStatus?.filter(f => 
    f.data_ativacao_rumiflow && // Só considera fazendas com data de ativação
    (f.dias_sem_afericao === null || f.dias_sem_afericao > 30)
  ) || [];

  // Fazendas em dia (com aferição nos últimos 30 dias)
  const fazendasEmDia = fazendasStatus?.filter(f => 
    f.data_ativacao_rumiflow && 
    f.dias_sem_afericao !== null && 
    f.dias_sem_afericao <= 30
  ) || [];

  // Fazendas sem data de ativação
  const fazendasSemAtivacao = fazendasStatus?.filter(f => !f.data_ativacao_rumiflow) || [];

  const totalAtivas = fazendasStatus?.filter(f => f.data_ativacao_rumiflow).length || 0;

  const statCards = [
    {
      title: 'Fazendas Ativas',
      value: totalAtivas,
      icon: Users,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      title: 'Precisam de Aferição',
      value: fazendasAtencao.length,
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Em Dia',
      value: fazendasEmDia.length,
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ];

  const getDiasLabel = (dias: number | null) => {
    if (dias === null) return 'Sem aferição';
    if (dias === 0) return 'Hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  };

  const getDiasBadgeVariant = (dias: number | null) => {
    if (dias === null) return 'bg-destructive text-destructive-foreground';
    if (dias > 60) return 'bg-destructive text-destructive-foreground';
    if (dias > 30) return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}!</h1>
        <p className="text-muted-foreground">
          Dashboard de Acompanhamento - Estoque Químicos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Análise de Desvios por Produto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Análise de Consumo vs Orçado (30 dias)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparativo baseado em fazendas com aferição nos últimos 30 dias
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingDesvios ? (
            <p className="text-muted-foreground text-sm">Carregando análise...</p>
          ) : !desviosProdutos || desviosProdutos.length === 0 ? (
            <div className="text-center py-8">
              <Beaker className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Dados insuficientes para análise. Necessário pelo menos 2 aferições por fazenda.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {desviosProdutos.map((produto) => {
                const isPositivo = produto.desvio_litros > 0;
                const isNeutro = produto.desvio_litros === 0;
                const DesvioIcon = isNeutro ? Minus : isPositivo ? TrendingUp : TrendingDown;
                const desvioColor = isNeutro 
                  ? 'text-muted-foreground' 
                  : isPositivo 
                    ? 'text-warning' 
                    : 'text-success';

                return (
                  <Card key={produto.produto_id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold">{produto.produto_nome}</h4>
                        <Badge variant="secondary">
                          {produto.fazendas_analisadas} fazenda{produto.fazendas_analisadas !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Orçado</p>
                          <p className="text-lg font-medium">
                            {produto.orcado_litros.toLocaleString('pt-BR')} L
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Realizado</p>
                          <p className="text-lg font-medium">
                            {produto.realizado_litros.toLocaleString('pt-BR')} L
                          </p>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 ${desvioColor}`}>
                        <DesvioIcon className="h-4 w-4" />
                        <span className="font-semibold">
                          {isPositivo ? '+' : ''}{produto.desvio_litros.toLocaleString('pt-BR')} L
                        </span>
                        <span className="text-sm">
                          ({isPositivo ? '+' : ''}{produto.desvio_percentual}%)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isPositivo 
                          ? 'Consumo acima do esperado' 
                          : isNeutro 
                            ? 'Consumo dentro do esperado'
                            : 'Consumo abaixo do esperado'}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de fazendas que precisam de aferição */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Fazendas sem Aferição há mais de 30 dias
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/estoque">
                <Beaker className="h-4 w-4 mr-2" />
                Ir para Aferição
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : fazendasAtencao.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
              <p className="text-muted-foreground">
                Todas as fazendas ativas estão com aferição em dia!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produtor</TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Data Ativação</TableHead>
                  <TableHead>Última Aferição</TableHead>
                  <TableHead>Dias sem Aferição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fazendasAtencao
                  .sort((a, b) => (b.dias_sem_afericao || 999) - (a.dias_sem_afericao || 999))
                  .map((fazenda) => (
                  <TableRow key={fazenda.id}>
                    <TableCell className="font-medium">{fazenda.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {fazenda.fazenda || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fazenda.data_ativacao_rumiflow 
                        ? format(parseISO(fazenda.data_ativacao_rumiflow), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fazenda.ultima_afericao 
                        ? format(parseISO(fazenda.ultima_afericao), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Nunca'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge className={getDiasBadgeVariant(fazenda.dias_sem_afericao)}>
                        {getDiasLabel(fazenda.dias_sem_afericao)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fazendas sem data de ativação configurada */}
      {fazendasSemAtivacao.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Fazendas sem Data de Ativação
                <Badge variant="secondary">{fazendasSemAtivacao.length}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/clientes">
                  Configurar
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Estas fazendas não aparecem no acompanhamento pois não possuem data de ativação no RumiFlow configurada.
            </p>
            <div className="flex flex-wrap gap-2">
              {fazendasSemAtivacao.slice(0, 10).map(f => (
                <Badge key={f.id} variant="outline">
                  {f.fazenda || f.nome}
                </Badge>
              ))}
              {fazendasSemAtivacao.length > 10 && (
                <Badge variant="outline">+{fazendasSemAtivacao.length - 10} mais</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
