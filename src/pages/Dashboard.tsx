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

  // Query para análise de desvios por produto
  const { data: desviosProdutos, isLoading: isLoadingDesvios } = useQuery({
    queryKey: ['dashboard-desvios-produtos'],
    queryFn: async () => {
      const hoje = new Date();
      const limite30dias = format(subDays(hoje, 30), 'yyyy-MM-dd');

      // Busca produtos ativos
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos_quimicos')
        .select('id, nome, litros_por_vaca_mes')
        .eq('ativo', true);

      if (produtosError) throw produtosError;

      // Busca aferições dos últimos 30 dias com vacas_lactacao
      const { data: afericoesRecentes, error: afericoesError } = await supabase
        .from('estoque_cliente')
        .select('cliente_id, produto_id, galoes_cheios, nivel_galao_parcial, vacas_lactacao, data_afericao')
        .gte('data_afericao', limite30dias)
        .order('data_afericao', { ascending: false });

      if (afericoesError) throw afericoesError;

      // Busca envios dos últimos 60 dias (para calcular consumo)
      const limite60dias = format(subDays(hoje, 60), 'yyyy-MM-dd');
      const { data: envios, error: enviosError } = await supabase
        .from('envios_produtos')
        .select('cliente_id, produto_id, galoes, data_envio')
        .gte('data_envio', limite60dias);

      if (enviosError) throw enviosError;

      // Busca aferições anteriores para calcular consumo
      const { data: todasAfericoes, error: todasError } = await supabase
        .from('estoque_cliente')
        .select('cliente_id, produto_id, galoes_cheios, nivel_galao_parcial, data_afericao')
        .gte('data_afericao', limite60dias)
        .order('data_afericao', { ascending: false });

      if (todasError) throw todasError;

      // Agrupa por cliente/produto - pega a última aferição com vacas_lactacao
      const ultimaAfericaoPorClienteProduto: Record<string, {
        vacas_lactacao: number;
        galoes_cheios: number;
        nivel_galao_parcial: number | null;
        data_afericao: string;
      }> = {};

      afericoesRecentes?.forEach(af => {
        const key = `${af.cliente_id}_${af.produto_id}`;
        if (!ultimaAfericaoPorClienteProduto[key] && af.vacas_lactacao) {
          ultimaAfericaoPorClienteProduto[key] = {
            vacas_lactacao: af.vacas_lactacao,
            galoes_cheios: af.galoes_cheios,
            nivel_galao_parcial: af.nivel_galao_parcial,
            data_afericao: af.data_afericao,
          };
        }
      });

      // Para cada cliente/produto, busca aferição anterior
      const afericaoAnteriorPorClienteProduto: Record<string, {
        galoes_cheios: number;
        nivel_galao_parcial: number | null;
        data_afericao: string;
      }> = {};

      todasAfericoes?.forEach(af => {
        const key = `${af.cliente_id}_${af.produto_id}`;
        const ultimaData = ultimaAfericaoPorClienteProduto[key]?.data_afericao;
        
        if (ultimaData && af.data_afericao < ultimaData) {
          if (!afericaoAnteriorPorClienteProduto[key]) {
            afericaoAnteriorPorClienteProduto[key] = {
              galoes_cheios: af.galoes_cheios,
              nivel_galao_parcial: af.nivel_galao_parcial,
              data_afericao: af.data_afericao,
            };
          }
        }
      });

      // Mantém envios com datas para filtrar por período
      const enviosComData = envios || [];

      // Calcula desvios por produto
      const desviosPorProduto: Record<string, {
        orcado: number;
        realizado: number;
        fazendas: Set<string>;
      }> = {};

      const LITROS_POR_GALAO = 50;

      Object.entries(ultimaAfericaoPorClienteProduto).forEach(([key, dados]) => {
        const [clienteId, produtoId] = key.split('_');
        const produto = produtos?.find(p => p.id === produtoId);
        
        if (!produto || !produto.litros_por_vaca_mes) return;

        const anterior = afericaoAnteriorPorClienteProduto[key];
        
        if (!anterior) return; // Precisa de 2 aferições para calcular consumo

        // Calcula período em dias
        const diasPeriodo = differenceInDays(
          parseISO(dados.data_afericao),
          parseISO(anterior.data_afericao)
        );

        if (diasPeriodo <= 0) return;

        // Calcula estoque em litros (galões cheios + parcial)
        const estoqueAtualLitros = (dados.galoes_cheios * LITROS_POR_GALAO) + 
          ((dados.nivel_galao_parcial || 0) * LITROS_POR_GALAO / 100);
        const estoqueAnteriorLitros = (anterior.galoes_cheios * LITROS_POR_GALAO) + 
          ((anterior.nivel_galao_parcial || 0) * LITROS_POR_GALAO / 100);

        // Envios recebidos APENAS no período entre as duas aferições
        const enviosNoPeriodo = enviosComData
          .filter(env => 
            env.cliente_id === clienteId && 
            env.produto_id === produtoId &&
            env.data_envio > anterior.data_afericao &&
            env.data_envio <= dados.data_afericao
          )
          .reduce((sum, env) => sum + env.galoes, 0);
        
        const enviosRecebidos = enviosNoPeriodo * LITROS_POR_GALAO;

        // Consumo realizado = estoque anterior + envios - estoque atual
        const consumoRealizado = estoqueAnteriorLitros + enviosRecebidos - estoqueAtualLitros;

        // Normaliza para 30 dias
        const consumoRealizado30dias = (consumoRealizado / diasPeriodo) * 30;

        // Orçado = vacas × litros/vaca/mês (já é mensal)
        const orcado30dias = dados.vacas_lactacao * produto.litros_por_vaca_mes;

        if (!desviosPorProduto[produtoId]) {
          desviosPorProduto[produtoId] = { orcado: 0, realizado: 0, fazendas: new Set() };
        }

        desviosPorProduto[produtoId].orcado += orcado30dias;
        desviosPorProduto[produtoId].realizado += consumoRealizado30dias;
        desviosPorProduto[produtoId].fazendas.add(clienteId);
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
            orcado_litros: Math.round(dados.orcado),
            realizado_litros: Math.round(dados.realizado),
            desvio_litros: Math.round(desvioLitros),
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
