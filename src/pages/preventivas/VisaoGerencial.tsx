import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KPICard } from '@/components/gerencial/KPICard';
import { FunnelChart } from '@/components/gerencial/FunnelChart';
import { RankingBar } from '@/components/gerencial/RankingBar';
import {
  FilterBarPreventivas,
  type PreventivasFilters,
  type FazendaStatus,
} from '@/components/gerencial/FilterBarPreventivas';
import { useFieldTechnicians, presets } from '@/components/gerencial/filterBarShared';

const DEFAULT_FREQUENCY = 90;

type ClientStatus = FazendaStatus;

interface ClientRow {
  id: string;
  nome: string;
  fazenda: string | null;
  preventive_frequency_days: number | null;
  status: string | null;
}

interface PmRow {
  client_id: string;
  completed_date: string | null;
  status: string;
  technician_user_id: string | null;
}

interface RouteRow {
  id: string;
  status: string;
  created_at: string;
  start_date: string;
  end_date: string;
  field_technician_user_id: string;
  preventive_route_items: { id: string; client_id: string; status: string }[] | null;
}

const fmtDate = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : undefined);

function classify(daysUntil: number | null): ClientStatus {
  if (daysUntil === null) return 'sem_historico';
  if (daysUntil < 0) return 'atrasada';
  if (daysUntil <= 30) return 'elegivel';
  return 'em_dia';
}

export default function VisaoGerencialPreventivas() {
  const [filters, setFilters] = useState<PreventivasFilters>(() => ({
    dateRange: presets.trimestreAtual(),
    selectedTecnicos: [],
    selectedStatus: null,
  }));

  const from = fmtDate(filters.dateRange?.from);
  const to = fmtDate(filters.dateRange?.to ?? filters.dateRange?.from);

  const { data: technicians = [] } = useFieldTechnicians();
  const techName = (id: string) => technicians.find((t) => t.id === id)?.nome ?? 'Técnico';

  // Rotas do período (com itens)
  const { data: routes, isLoading: loadingRoutes } = useQuery({
    queryKey: ['prev-gerencial-routes', from, to, filters.selectedTecnicos],
    queryFn: async () => {
      let q = supabase
        .from('preventive_routes')
        .select('id, status, created_at, start_date, end_date, field_technician_user_id, preventive_route_items(id, client_id, status)');
      if (from) q = q.gte('start_date', from);
      if (to) q = q.lte('start_date', to);
      if (filters.selectedTecnicos.length > 0) q = q.in('field_technician_user_id', filters.selectedTecnicos);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RouteRow[];
    },
    enabled: Boolean(from),
  });

  // Período anterior (mesmo tamanho) para delta de aderência
  const prevWindow = useMemo(() => {
    if (!filters.dateRange?.from) return null;
    const f = filters.dateRange.from;
    const t = filters.dateRange.to ?? filters.dateRange.from;
    const len = differenceInCalendarDays(t, f) + 1;
    const prevTo = new Date(f);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (len - 1));
    return { from: format(prevFrom, 'yyyy-MM-dd'), to: format(prevTo, 'yyyy-MM-dd') };
  }, [filters.dateRange]);

  const { data: prevRoutes } = useQuery({
    queryKey: ['prev-gerencial-routes-prev', prevWindow, filters.selectedTecnicos],
    queryFn: async () => {
      let q = supabase
        .from('preventive_routes')
        .select('id, status')
        .gte('start_date', prevWindow!.from)
        .lte('start_date', prevWindow!.to);
      if (filters.selectedTecnicos.length > 0) q = q.in('field_technician_user_id', filters.selectedTecnicos);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(prevWindow),
  });

  // Carteira de clientes ativos
  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['prev-gerencial-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, preventive_frequency_days, status')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  // Preventivas concluídas (histórico completo para calcular última data)
  const { data: preventivas, isLoading: loadingPm } = useQuery({
    queryKey: ['prev-gerencial-pm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_maintenance')
        .select('client_id, completed_date, status, technician_user_id')
        .eq('status', 'concluida');
      if (error) throw error;
      return (data ?? []) as PmRow[];
    },
  });

  const isLoading = loadingRoutes || loadingClientes || loadingPm;

  // ---- Estado da carteira por cliente ----
  const carteira = useMemo(() => {
    const lastByClient = new Map<string, string>();
    (preventivas ?? []).forEach((p) => {
      if (!p.completed_date) return;
      const cur = lastByClient.get(p.client_id);
      if (!cur || p.completed_date > cur) lastByClient.set(p.client_id, p.completed_date);
    });

    const today = new Date();
    return (clientes ?? [])
      .filter((c) => (c.status ?? 'ativo') !== 'inativo')
      .map((c) => {
        const last = lastByClient.get(c.id) ?? null;
        const freq = c.preventive_frequency_days ?? DEFAULT_FREQUENCY;
        const daysSince = last ? differenceInCalendarDays(today, new Date(`${last}T00:00:00`)) : null;
        const daysUntil = daysSince === null ? null : freq - daysSince;
        return {
          id: c.id,
          nome: c.fazenda ? `${c.nome} · ${c.fazenda}` : c.nome,
          last,
          freq,
          daysSince,
          daysUntil,
          status: classify(daysUntil),
        };
      });
  }, [clientes, preventivas]);

  const kpis = useMemo(() => {
    const total = carteira.length;
    const emDia = carteira.filter((c) => c.status === 'em_dia').length;
    const elegiveis = carteira.filter((c) => c.status === 'elegivel');
    const proximos15 = elegiveis.filter((c) => (c.daysUntil ?? 99) <= 15).length;
    const atrasadas = carteira.filter((c) => c.status === 'atrasada');
    const mediaAtraso = atrasadas.length
      ? Math.round(atrasadas.reduce((s, c) => s + Math.abs(c.daysUntil ?? 0), 0) / atrasadas.length)
      : 0;
    const semHistorico = carteira.filter((c) => c.status === 'sem_historico').length;

    const rows = routes ?? [];
    const concluidas = rows.filter((r) => r.status === 'finalizada').length;
    const planejadas = rows.length;
    const aderencia = planejadas > 0 ? Math.round((concluidas / planejadas) * 100) : 0;

    const prevRows = prevRoutes ?? [];
    const prevConcl = prevRows.filter((r) => r.status === 'finalizada').length;
    const prevAderencia = prevRows.length > 0 ? Math.round((prevConcl / prevRows.length) * 100) : 0;
    const diff = aderencia - prevAderencia;

    return {
      total,
      emDia,
      elegiveis: elegiveis.length,
      proximos15,
      atrasadas: atrasadas.length,
      mediaAtraso,
      semHistorico,
      concluidas,
      planejadas,
      aderencia,
      delta: prevRows.length
        ? { direction: (diff >= 0 ? 'up' : 'down') as 'up' | 'down', text: `${diff >= 0 ? '+' : ''}${diff} p.p. vs período anterior` }
        : undefined,
    };
  }, [carteira, routes, prevRoutes]);

  const funnelSteps = useMemo(
    () => [
      { label: 'Em dia', count: kpis.emDia, color: 'text-green-600 dark:text-green-400' },
      { label: 'Elegíveis', count: kpis.elegiveis, color: 'text-amber-600 dark:text-amber-400' },
      { label: 'Atrasadas', count: kpis.atrasadas, color: 'text-red-600 dark:text-red-400' },
      { label: 'Sem histórico', count: kpis.semHistorico, color: 'text-blue-600 dark:text-blue-400' },
    ],
    [kpis],
  );

  // Rotas concluídas por mês
  const rotasPorMes = useMemo(() => {
    const map = new Map<string, number>();
    (routes ?? [])
      .filter((r) => r.status === 'finalizada')
      .forEach((r) => {
        const d = new Date(r.created_at);
        const key = format(startOfMonth(d), 'yyyy-MM');
        map.set(key, (map.get(key) ?? 0) + 1);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({
        mes: format(new Date(`${key}-01T00:00:00`), 'MMM/yy', { locale: ptBR }),
        rotas: count,
      }));
  }, [routes]);

  // Fazendas mais atrasadas (respeita filtro de status quando aplicado)
  const rankingFazendas = useMemo(() => {
    const base = filters.selectedStatus
      ? carteira.filter((c) => c.status === filters.selectedStatus)
      : carteira.filter((c) => c.status === 'atrasada');
    return base
      .slice()
      .sort((a, b) => (b.daysUntil === null ? -1 : a.daysUntil === null ? 1 : a.daysUntil - b.daysUntil))
      .slice(0, 10)
      .map((c) => ({
        name: c.nome,
        count: c.daysUntil === null ? 'sem histórico' : `${Math.abs(c.daysUntil)}d`,
        barColor: c.status === 'atrasada' ? 'bg-red-600' : c.status === 'elegivel' ? 'bg-amber-500' : 'bg-blue-600',
      }));
  }, [carteira, filters.selectedStatus]);

  // Produtividade por técnico
  const produtividade = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const map = new Map<
      string,
      { rotas: number; concluidas: number; fazendas: number; duracaoTotal: number; emAtraso: number }
    >();
    (routes ?? []).forEach((r) => {
      const cur =
        map.get(r.field_technician_user_id) ??
        { rotas: 0, concluidas: 0, fazendas: 0, duracaoTotal: 0, emAtraso: 0 };
      cur.rotas += 1;
      if (r.status === 'finalizada') {
        cur.concluidas += 1;
        cur.duracaoTotal += differenceInCalendarDays(new Date(r.end_date), new Date(r.start_date)) + 1;
      }
      if (r.status !== 'finalizada' && r.end_date < today) cur.emAtraso += 1;
      cur.fazendas += (r.preventive_route_items ?? []).filter((i) => i.status === 'executado').length;
      map.set(r.field_technician_user_id, cur);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({
        id,
        nome: techName(id),
        ...v,
        tempoMedio: v.concluidas > 0 ? (v.duracaoTotal / v.concluidas).toFixed(1) : '—',
      }))
      .sort((a, b) => b.concluidas - a.concluidas);
  }, [routes, technicians]);

  const periodoLabel =
    filters.dateRange?.from && filters.dateRange?.to
      ? `${format(filters.dateRange.from, 'dd MMM yyyy', { locale: ptBR })} — ${format(endOfMonth(filters.dateRange.to) > filters.dateRange.to ? filters.dateRange.to : filters.dateRange.to, 'dd MMM yyyy', { locale: ptBR })}`
      : 'Período não definido';

  return (
    <div className="p-4 md:p-6 animate-fade-in" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Manutenção Preventiva · Visão Gerencial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cobertura da carteira, aderência de rotas e produtividade dos técnicos de campo · {periodoLabel}
        </p>
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
            value={`${kpis.aderencia}%`}
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
            {rotasPorMes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma rota concluída no período.</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rotasPorMes}>
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
            {rankingFazendas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma fazenda encontrada.</p>
            ) : (
              <RankingBar items={rankingFazendas} />
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
                    <th className="py-2 pr-3 font-medium text-right">Duração média (dias)</th>
                    <th className="py-2 font-medium text-right">Em atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {produtividade.map((t) => (
                    <tr key={t.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 min-w-0 truncate">{t.nome}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.rotas}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.concluidas}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.fazendas}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.tempoMedio}</td>
                      <td
                        className={`py-2 text-right font-mono ${t.emAtraso > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}
                      >
                        {t.emAtraso}
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
