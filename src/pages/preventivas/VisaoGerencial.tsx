import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KPICard } from '@/components/gerencial/KPICard';
import { FunnelChart } from '@/components/gerencial/FunnelChart';
import { RankingBar } from '@/components/gerencial/RankingBar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  FilterBarPreventivas,
  type PreventivasFilters,
} from '@/components/gerencial/FilterBarPreventivas';
import { useFieldTechnicians, presets } from '@/components/gerencial/filterBarShared';
import {
  fetchCarteiraStatus,
  fetchRotasConcluidasPorMes,
  fetchTopFazendasAtrasadas,
  fetchProdutividadeTecnicos,
  fetchAderenciaRotas,
  type GerencialParams,
} from '@/lib/queries/preventivasGerencial';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export default function VisaoGerencialPreventivas() {
  const [filters, setFilters] = useState<PreventivasFilters>(() => ({
    dateRange: presets.trimestreAtual(),
    selectedTecnicos: [],
    selectedStatus: null,
  }));

  const { data: technicians = [] } = useFieldTechnicians();
  const techName = (id: string) => technicians.find((t) => t.id === id)?.nome ?? 'Técnico';

  const params: GerencialParams | null = useMemo(() => {
    const f = filters.dateRange?.from;
    if (!f) return null;
    const t = filters.dateRange?.to ?? f;
    return {
      from: fmt(f),
      to: fmt(t),
      tecnicoIds: filters.selectedTecnicos,
      status: filters.selectedStatus,
    };
  }, [filters]);

  const periods = useMemo(() => {
    if (!params) return null;
    const f = new Date(`${params.from}T00:00:00`);
    const t = new Date(`${params.to}T00:00:00`);
    const len = differenceInCalendarDays(t, f) + 1;
    const prevTo = new Date(f);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (len - 1));
    return {
      atual: { from: params.from, to: params.to },
      anterior: { from: fmt(prevFrom), to: fmt(prevTo) },
    };
  }, [params]);

  // 1. Carteira por status (sem filtro de status para os KPIs / funil)
  const { data: carteira = [], isLoading: loadingCarteira } = useQuery({
    queryKey: ['prev-ger-carteira', params?.from, params?.to, params?.tecnicoIds],
    queryFn: () => fetchCarteiraStatus({ ...params!, status: null }),
    enabled: Boolean(params),
  });

  // 2. Rotas concluídas por mês
  const { data: rotasMes = [], isLoading: loadingMes } = useQuery({
    queryKey: ['prev-ger-rotas-mes', params?.from, params?.to, params?.tecnicoIds],
    queryFn: () => fetchRotasConcluidasPorMes(params!),
    enabled: Boolean(params),
  });

  // 3. Top fazendas atrasadas (respeita filtro de status quando definido)
  const { data: topAtrasadas = [] } = useQuery({
    queryKey: ['prev-ger-top-atrasadas', params?.from, params?.to, params?.tecnicoIds, params?.status],
    queryFn: () => fetchTopFazendasAtrasadas(params!, 10),
    enabled: Boolean(params),
  });

  // 4. Produtividade por técnico
  const { data: produtividade = [], isLoading: loadingProd } = useQuery({
    queryKey: ['prev-ger-produtividade', params?.from, params?.to, params?.tecnicoIds],
    queryFn: () => fetchProdutividadeTecnicos(params!),
    enabled: Boolean(params),
  });

  // 5. Aderência de rotas (atual vs anterior)
  const { data: aderencia } = useQuery({
    queryKey: ['prev-ger-aderencia', periods, params?.tecnicoIds],
    queryFn: () => fetchAderenciaRotas(periods!, params!.tecnicoIds),
    enabled: Boolean(periods),
  });

  const kpis = useMemo(() => {
    const total = carteira.length;
    const emDia = carteira.filter((c) => c.status === 'em_dia').length;
    const elegiveis = carteira.filter((c) => c.status === 'elegivel');
    const proximos15 = elegiveis.filter((c) => (c.dias_restantes ?? 99) <= 15).length;
    const atrasadas = carteira.filter((c) => c.status === 'atrasada');
    const mediaAtraso = atrasadas.length
      ? Math.round(atrasadas.reduce((s, c) => s + c.dias_atraso, 0) / atrasadas.length)
      : 0;
    const semHistorico = carteira.filter((c) => c.status === 'sem_historico').length;

    const pctAtual =
      aderencia && aderencia.planejadas_atual > 0
        ? Math.round((aderencia.concluidas_atual / aderencia.planejadas_atual) * 100)
        : 0;
    const pctAnterior =
      aderencia && aderencia.planejadas_anterior > 0
        ? Math.round((aderencia.concluidas_anterior / aderencia.planejadas_anterior) * 100)
        : null;
    const diff = pctAnterior === null ? null : pctAtual - pctAnterior;

    return {
      total,
      emDia,
      elegiveis: elegiveis.length,
      proximos15,
      atrasadas: atrasadas.length,
      mediaAtraso,
      semHistorico,
      pctAtual,
      concluidas: aderencia?.concluidas_atual ?? 0,
      planejadas: aderencia?.planejadas_atual ?? 0,
      delta:
        diff === null
          ? undefined
          : {
              direction: (diff >= 0 ? 'up' : 'down') as 'up' | 'down',
              text: `${diff >= 0 ? '+' : ''}${diff} p.p. vs período anterior`,
            },
    };
  }, [carteira, aderencia]);

  const funnelSteps = useMemo(
    () => [
      { label: 'Em dia', count: kpis.emDia, color: 'text-green-600 dark:text-green-400' },
      { label: 'Elegíveis', count: kpis.elegiveis, color: 'text-amber-600 dark:text-amber-400' },
      { label: 'Atrasadas', count: kpis.atrasadas, color: 'text-red-600 dark:text-red-400' },
      { label: 'Sem histórico', count: kpis.semHistorico, color: 'text-blue-600 dark:text-blue-400' },
    ],
    [kpis],
  );

  const chartData = useMemo(
    () =>
      rotasMes.map((r) => ({
        mes: format(new Date(r.ano, r.mes - 1, 1), 'MMM/yy', { locale: ptBR }),
        rotas: r.count,
      })),
    [rotasMes],
  );

  const rankingItems = useMemo(
    () =>
      topAtrasadas.map((f) => ({
        name: f.tecnico_atribuido ? `${f.nome} — ${techName(f.tecnico_atribuido)}` : f.nome,
        count: `${f.dias_atraso}d`,
        barColor: 'bg-red-600',
      })),
    [topAtrasadas, technicians],
  );

  const periodoLabel = params
    ? `${format(new Date(`${params.from}T00:00:00`), 'dd MMM yyyy', { locale: ptBR })} — ${format(new Date(`${params.to}T00:00:00`), 'dd MMM yyyy', { locale: ptBR })}`
    : 'Período não definido';

  const isLoading = loadingCarteira || loadingMes || loadingProd;

  return (
    <div className="p-4 md:p-6 animate-fade-in" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div className="mb-4 space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin/dashboards">Dashboards</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Gestão de Preventivas</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div>
          <h1 className="text-xl font-bold text-foreground">Gestão de Preventivas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cobertura da carteira, aderência de rotas e produtividade dos técnicos de campo · {periodoLabel}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <FilterBarPreventivas defaultPreset="trimestre" onFilterChange={setFilters} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" style={{ marginBottom: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" style={{ marginBottom: 16 }}>
          <KPICard
            label="% Em dia"
            value={kpis.total > 0 ? `${Math.round((kpis.emDia / kpis.total) * 100)}%` : '0%'}
            subtext={`${kpis.emDia}/${kpis.total} fazendas`}
            iconType="success"
          />
          <KPICard
            label="Elegíveis"
            value={String(kpis.elegiveis)}
            subtext={`${kpis.proximos15} vencem nos próximos 15 dias`}
            iconType="warning"
          />
          <KPICard
            label="Atrasadas"
            value={String(kpis.atrasadas)}
            subtext={`${kpis.mediaAtraso} dias de atraso médio`}
            iconType="critical"
          />
          <KPICard
            label="Sem histórico"
            value={String(kpis.semHistorico)}
            subtext="Fazendas nunca atendidas"
            iconType="info"
          />
          <KPICard
            label="Aderência de rotas"
            value={`${kpis.pctAtual}%`}
            subtext={`${kpis.concluidas}/${kpis.planejadas} rotas concluídas`}
            iconType="purple"
            delta={kpis.delta}
          />
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Cobertura da carteira por status</CardTitle>
        </CardHeader>
        <CardContent>
          <FunnelChart steps={funnelSteps} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Rotas concluídas por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma rota concluída no período.</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="rotas"
                      name="Rotas concluídas"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                      animationDuration={700}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {filters.selectedStatus ? 'Fazendas no status selecionado' : 'Fazendas mais atrasadas'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingItems.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma fazenda encontrada.</p>
            ) : (
              <RankingBar items={rankingItems} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Produtividade por técnico</CardTitle>
        </CardHeader>
        <CardContent>
          {produtividade.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma rota no período filtrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: '12.5px' }}>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Técnico</th>
                    <th className="py-2 pr-3 font-medium text-right">Rotas</th>
                    <th className="py-2 pr-3 font-medium text-right">Concluídas</th>
                    <th className="py-2 pr-3 font-medium text-right">Fazendas visitadas</th>
                    <th className="py-2 pr-3 font-medium text-right">Tempo médio / visita</th>
                    <th className="py-2 font-medium text-right">Em atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {produtividade.map((t) => (
                    <tr key={t.tecnico_id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 min-w-0 truncate">{techName(t.tecnico_id)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.rotas_total}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.rotas_concluidas}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.fazendas_visitadas}</td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {t.tempo_medio_minutos === null ? '—' : `${t.tempo_medio_minutos} min`}
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${t.em_atraso_count > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}
                      >
                        {t.em_atraso_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
