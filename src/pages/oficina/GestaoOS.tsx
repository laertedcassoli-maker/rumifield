import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { DetalheOSDialog } from '@/components/oficina/DetalheOSDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wrench, CheckCircle, Timer, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Granularity = 'semana' | 'mes' | 'trimestre' | 'personalizado';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface WorkOrderRow {
  id: string;
  code: string;
  status: 'aguardando' | 'em_manutencao' | 'concluido';
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  total_time_seconds: number | null;
  created_by_user_id: string | null;
  concluded_by_user_id: string | null;
  assigned_to_user_id: string | null;
  activities?: { id: string; name: string; execution_type: string } | null;
  work_order_items?: Array<{
    workshop_item_id: string | null;
    omie_product_id: string | null;
    workshop_items?: {
      unique_code: string | null;
      pecas?: { nome: string } | null;
    } | null;
  }>;
  work_order_parts_used?: Array<{
    omie_product_id: string | null;
    quantity: number | null;
    pecas?: { nome: string } | null;
  }>;
}

export default function GestaoOS() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [granularity, setGranularity] = useState<Granularity>('mes');
  const [selectedMonths, setSelectedMonths] = useState<number[]>([currentMonth]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showAllRows, setShowAllRows] = useState(false);
  const [onlyLongLead, setOnlyLongLead] = useState(false);
  const [openDialogOS, setOpenDialogOS] = useState<any | null>(null);

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['gestao-os', currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          id, code, status, created_at, start_time, end_time,
          total_time_seconds, created_by_user_id, concluded_by_user_id,
          activities:activity_id (id, name, execution_type),
          work_order_items (
            workshop_item_id, omie_product_id,
            workshop_items:workshop_item_id (
              unique_code,
              pecas:omie_product_id (nome)
            )
          ),
          work_order_parts_used (omie_product_id, quantity,
            pecas:omie_product_id (nome))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as WorkOrderRow[];
    },
  });

  const userIds = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach(wo => {
      if (wo.created_by_user_id) set.add(wo.created_by_user_id);
      if (wo.concluded_by_user_id) set.add(wo.concluded_by_user_id);
    });
    return Array.from(set);
  }, [workOrders]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ['gestao-os-profiles', userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', userIds);
      if (error) throw error;
      const map: Record<string, { nome: string | null; email: string | null }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome, email: p.email };
      });
      return map;
    },
  });

  void profilesMap;

  const availableActivities = useMemo(() => {
    const map = new Map<string, string>();
    workOrders.forEach(wo => {
      if (wo.activities?.id && wo.activities?.name) {
        map.set(wo.activities.id, wo.activities.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workOrders]);

  const filteredOS = useMemo(() => {
    return workOrders.filter(wo => {
      const d = new Date(wo.created_at);
      if (d.getFullYear() !== currentYear) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(d.getMonth())) return false;
      if (selectedActivities.length > 0) {
        if (!wo.activities?.id || !selectedActivities.includes(wo.activities.id)) return false;
      }
      return true;
    });
  }, [workOrders, selectedMonths, selectedActivities, currentYear]);

  const periodLabel = useMemo(() => {
    if (selectedMonths.length === 0) return `${currentYear}`;
    const sorted = [...selectedMonths].sort((a, b) => a - b);
    const isContiguous = sorted.every((m, i) => i === 0 || m === sorted[i - 1] + 1);
    if (isContiguous && sorted.length > 1) {
      return `${MONTHS[sorted[0]]} – ${MONTHS[sorted[sorted.length - 1]]} ${currentYear}`;
    }
    if (sorted.length === 1) return `${MONTHS[sorted[0]]} ${currentYear}`;
    return `${sorted.map(m => MONTHS[m]).join(', ')} ${currentYear}`;
  }, [selectedMonths, currentYear]);

  const toggleMonth = (m: number) => {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const toggleActivity = (id: string) => {
    setSelectedActivities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const kpis = useMemo(() => {
    const concluded = filteredOS.filter(wo => wo.status === 'concluido');
    const concludedCount = concluded.length;

    const timesSec = concluded.map(wo => wo.total_time_seconds || 0).filter(s => s > 0);
    const avgTimeSec = timesSec.length ? timesSec.reduce((a, b) => a + b, 0) / timesSec.length : 0;
    const avgTimeH = Math.floor(avgTimeSec / 3600);
    const avgTimeMin = Math.round((avgTimeSec % 3600) / 60);
    const avgTimeLabel = timesSec.length
      ? (avgTimeH > 0 ? `${avgTimeH}h ${avgTimeMin}min` : `${avgTimeMin}min`)
      : '—';

    const leadDays = concluded
      .filter(wo => wo.end_time && wo.created_at)
      .map(wo => (new Date(wo.end_time!).getTime() - new Date(wo.created_at).getTime()) / 86400000);
    const avgLead = leadDays.length ? leadDays.reduce((a, b) => a + b, 0) / leadDays.length : 0;
    const avgLeadLabel = leadDays.length ? `${avgLead.toFixed(1)} dias` : '—';

    const longLeadCount = leadDays.filter(d => d > 30).length;
    const totalForPct = filteredOS.length;
    const longLeadPct = totalForPct > 0 ? (longLeadCount / totalForPct) * 100 : 0;

    return { concludedCount, avgTimeLabel, avgLead, avgLeadLabel, longLeadCount, longLeadPct, totalForPct };
  }, [filteredOS]);


  const categorize = (name?: string | null): string => {
    const n = (name || '').toLowerCase();
    if (n.includes('pistola')) return 'Reparo pistola';
    if (n.includes('solenoide')) return 'Solenoide';
    if (n.includes('counter balance')) return 'Counter balance';
    if (n.includes('montagem') || n.includes('preparo')) return 'Montagem / Preparo';
    return 'Outros';
  };

  const CATEGORY_COLORS: Record<string, string> = {
    'Reparo pistola': '#2563EB',
    'Solenoide': '#10B981',
    'Counter balance': '#F59E0B',
    'Montagem / Preparo': '#F97316',
    'Outros': '#94A3B8',
  };

  const volumeByType = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOS.forEach(wo => {
      const cat = categorize(wo.activities?.name);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || '#94A3B8' }))
      .filter(d => d.value > 0);
  }, [filteredOS]);

  const openersTable = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOS.forEach(wo => {
      const key = wo.created_by_user_id || '__unknown__';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([uid, qty]) => {
        const p = (profilesMap as Record<string, { nome: string | null; email: string | null }>)[uid];
        const nome = uid === '__unknown__' ? 'Não informado' : (p?.nome || p?.email || 'Usuário desconhecido');
        return { uid, nome, qty };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [filteredOS, profilesMap]);

  const concludedByMonth = useMemo(() => {
    const counts = new Map<number, number>();
    filteredOS
      .filter(wo => wo.status === 'concluido')
      .forEach(wo => {
        const m = new Date(wo.created_at).getMonth();
        counts.set(m, (counts.get(m) || 0) + 1);
      });
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, total]) => ({ mes: MONTHS[m], total }));
  }, [filteredOS]);

  const pistolaModels = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOS
      .filter(wo => categorize(wo.activities?.name) === 'Reparo pistola')
      .forEach(wo => {
        (wo.work_order_items || []).forEach(it => {
          const nome = it.workshop_items?.pecas?.nome;
          if (nome) counts.set(nome, (counts.get(nome) || 0) + 1);
        });
      });
    const sorted = Array.from(counts.entries())
      .map(([nome, qty]) => ({ nome, qty }))
      .sort((a, b) => b.qty - a.qty);
    const top = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((acc, r) => acc + r.qty, 0);
    const list = restTotal > 0 ? [...top, { nome: '3+ outros modelos', qty: restTotal }] : top;
    const max = Math.max(1, ...list.map(l => l.qty));
    return { list, max };
  }, [filteredOS]);

  const tipoBadge = (name?: string | null): { label: string; cls: string } => {
    const n = (name || '').toLowerCase();
    if (n.includes('pistola') || n.includes('solenoide') || n.includes('counter')) {
      return { label: 'Reparo', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    if (n.includes('montagem') || n.includes('preparo')) {
      return { label: 'Montagem', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    }
    if (n.includes('lavagem')) {
      return { label: 'Lavagem', cls: 'bg-green-100 text-green-700 border-green-200' };
    }
    return { label: 'Outro', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const fmtDur = (sec: number | null) => {
    if (!sec || sec <= 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const leadDaysOf = (wo: WorkOrderRow) => {
    if (!wo.end_time || !wo.created_at) return null;
    return (new Date(wo.end_time).getTime() - new Date(wo.created_at).getTime()) / 86400000;
  };

  const concludedRows = useMemo(() => {
    return filteredOS
      .filter(wo => wo.status === 'concluido')
      .map(wo => ({ ...wo, _lead: leadDaysOf(wo) }))
      .sort((a, b) => new Date(b.end_time || b.created_at).getTime() - new Date(a.end_time || a.created_at).getTime());
  }, [filteredOS]);

  const displayedRows = useMemo(() => {
    const base = onlyLongLead ? concludedRows.filter(r => (r._lead ?? 0) > 30) : concludedRows;
    return showAllRows ? base : base.slice(0, 10);
  }, [concludedRows, onlyLongLead, showAllRows]);

  const alerts = useMemo(() => {
    const longLead = concludedRows.filter(r => (r._lead ?? 0) > 30);
    const oldest = [...concludedRows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
    const tinyTime = filteredOS.filter(wo => (wo.total_time_seconds ?? 0) > 0 && (wo.total_time_seconds ?? 0) < 60).length;
    return {
      longLeadCount: longLead.length,
      oldest,
      tinyTime,
    };
  }, [concludedRows, filteredOS]);



  return (

    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="h-7 w-7 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Oficina · Gestão de OS</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Granularidade */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Granularidade</p>
            <div className="flex flex-wrap gap-2">
              {(['semana', 'mes', 'trimestre', 'personalizado'] as Granularity[]).map(g => (
                <Button
                  key={g}
                  variant={granularity === g ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGranularity(g)}
                  className="capitalize"
                >
                  {g === 'mes' ? 'Mês' : g === 'personalizado' ? 'Personalizado' : g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Meses */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meses</p>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((label, idx) => {
                const active = selectedMonths.includes(idx);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleMonth(idx)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-input'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumo do período ativo */}
          <div>
            <Badge variant="secondary" className="text-sm">
              {periodLabel} · {filteredOS.length} OS
            </Badge>
          </div>

          {/* Tipos de atividade */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de atividade</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedActivities([])}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  selectedActivities.length === 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-input'
                )}
              >
                Todos os tipos
              </button>
              {availableActivities.map(a => {
                const active = selectedActivities.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleActivity(a.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-input'
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* OS Concluídas */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OS Concluídas</p>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-green-600">{kpis.concludedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">no período</p>
        </div>

        {/* Tempo médio / OS */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tempo médio / OS</p>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-bold">{kpis.avgTimeLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">por OS concluída</p>
        </div>

        {/* Lead time médio */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead time médio</p>
            <TrendingUp className={cn('h-4 w-4', kpis.avgLead > 10 ? 'text-orange-500' : 'text-green-600')} />
          </div>
          <p className={cn('mt-2 text-3xl font-bold', kpis.avgLead > 10 ? 'text-orange-500' : 'text-green-600')}>
            {kpis.avgLeadLabel}
          </p>
          <p className="text-xs text-muted-foreground mt-1">abertura → conclusão</p>
        </div>

        {/* OS com lead time > 30 dias */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead time &gt; 30 dias</p>
            <AlertTriangle className={cn(
              'h-4 w-4',
              kpis.longLeadPct > 10 ? 'text-red-600' : kpis.longLeadPct >= 5 ? 'text-orange-500' : 'text-green-600'
            )} />
          </div>
          <p className={cn(
            'mt-2 text-3xl font-bold',
            kpis.longLeadPct > 10 ? 'text-red-600' : kpis.longLeadPct >= 5 ? 'text-orange-500' : 'text-green-600'
          )}>
            {kpis.longLeadCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.totalForPct > 0 ? `${kpis.longLeadPct.toFixed(0)}% do total` : '—'}
          </p>
        </div>
      </div>

      {/* Volume por Tipo + Responsável Abertura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">Volume por Tipo de OS</h3>
          {volumeByType.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={volumeByType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {volumeByType.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: number, n: string) => [`${v} OS`, n]} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">Responsável Abertura</h3>
          {openersTable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left font-medium py-2 px-3">Nome</th>
                    <th className="text-right font-medium py-2 px-3">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {openersTable.map((row, i) => (
                    <tr key={row.uid} className={cn(i % 2 === 1 && 'bg-muted/40')}>
                      <td className="py-2 px-3">{row.nome}</td>
                      <td className="py-2 px-3 text-right font-medium tabular-nums">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* OS por mês + Tipos de pistola */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">OS Concluídas por Mês</h3>
          {concludedByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concludedByMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RTooltip formatter={(v: number) => [`${v} OS`, 'Total']} />
                  <Bar dataKey="total" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">Tipos de Pistola Reparada</h3>
          {pistolaModels.list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem reparos de pistola no período.</p>
          ) : (
            <div className="space-y-3">
              {pistolaModels.list.map((m) => {
                const pct = (m.qty / pistolaModels.max) * 100;
                return (
                  <div key={m.nome} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{m.nome}</span>
                      <span className="font-medium tabular-nums">{m.qty}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: '#2563EB' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabela: Últimas OS Concluídas */}
      <div className="rounded-xl border shadow-sm p-5 bg-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">
            Últimas OS Concluídas {onlyLongLead && <span className="text-xs text-red-600 font-normal">· filtro: Lead {'>'} 30d</span>}
          </h3>
          {onlyLongLead && (
            <Button variant="ghost" size="sm" onClick={() => setOnlyLongLead(false)}>
              Limpar filtro
            </Button>
          )}
        </div>

        {displayedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Sem OS concluídas no período.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 px-3">Código</th>
                    <th className="text-left font-medium py-2 px-3">Atividade / Item</th>
                    <th className="text-left font-medium py-2 px-3">Tipo</th>
                    <th className="text-left font-medium py-2 px-3">Abertura</th>
                    <th className="text-left font-medium py-2 px-3">Conclusão</th>
                    <th className="text-left font-medium py-2 px-3">Tempo Exec.</th>
                    <th className="text-left font-medium py-2 px-3">Lead Time</th>
                    <th className="text-left font-medium py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row, i) => {
                    const t = tipoBadge(row.activities?.name);
                    const lead = row._lead;
                    const leadColor = lead == null ? 'text-muted-foreground'
                      : lead > 30 ? 'text-red-600 font-semibold'
                      : lead >= 7 ? 'text-orange-500 font-medium'
                      : 'text-green-600 font-medium';
                    const itemCode = row.work_order_items?.[0]?.workshop_items?.unique_code;
                    return (
                      <tr key={row.id} className={cn('border-b last:border-b-0', i % 2 === 1 && 'bg-muted/30')}>
                        <td className="py-2 px-3">
                          <button onClick={() => setOpenDialogOS(row)} className="text-blue-600 hover:underline font-medium">
                            {row.code}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <div className="truncate max-w-[260px]">{row.activities?.name || '—'}</div>
                          {itemCode && <div className="text-xs text-muted-foreground">{itemCode}</div>}
                        </td>
                        <td className="py-2 px-3">
                          <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-medium', t.cls)}>{t.label}</span>
                        </td>
                        <td className="py-2 px-3 tabular-nums">{format(new Date(row.created_at), 'dd/MM/yy')}</td>
                        <td className="py-2 px-3 tabular-nums">{row.end_time ? format(new Date(row.end_time), 'dd/MM/yy') : '—'}</td>
                        <td className="py-2 px-3 tabular-nums">{fmtDur(row.total_time_seconds)}</td>
                        <td className={cn('py-2 px-3 tabular-nums', leadColor)}>
                          {lead == null ? '—' : `${lead.toFixed(1)} dias`}
                          {lead != null && lead > 30 && (
                            <span className="ml-2 inline-block rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-semibold">
                              Lead alto
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
                            Concluída
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {displayedRows.map(row => {
                const t = tipoBadge(row.activities?.name);
                const lead = row._lead;
                const leadColor = lead == null ? 'text-muted-foreground'
                  : lead > 30 ? 'text-red-600 font-semibold'
                  : lead >= 7 ? 'text-orange-500 font-medium'
                  : 'text-green-600 font-medium';
                const itemCode = row.work_order_items?.[0]?.workshop_items?.unique_code;
                return (
                  <div key={row.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setOpenDialogOS(row)} className="text-blue-600 hover:underline font-medium">
                        {row.code}
                      </button>
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-medium', t.cls)}>{t.label}</span>
                    </div>
                    <div className="text-sm">{row.activities?.name || '—'}</div>
                    {itemCode && <div className="text-xs text-muted-foreground">{itemCode}</div>}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                      <div>Abertura: <span className="text-foreground">{format(new Date(row.created_at), 'dd/MM/yy')}</span></div>
                      <div>Conclusão: <span className="text-foreground">{row.end_time ? format(new Date(row.end_time), 'dd/MM/yy') : '—'}</span></div>
                      <div>Tempo: <span className="text-foreground">{fmtDur(row.total_time_seconds)}</span></div>
                      <div>Lead: <span className={leadColor}>{lead == null ? '—' : `${lead.toFixed(1)}d`}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {(onlyLongLead ? concludedRows.filter(r => (r._lead ?? 0) > 30).length : concludedRows.length) > 10 && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowAllRows(v => !v)}>
                  {showAllRows
                    ? 'Mostrar menos'
                    : `Ver todas (${onlyLongLead ? concludedRows.filter(r => (r._lead ?? 0) > 30).length : concludedRows.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Alertas e Pontos de Atenção */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:justify-items-end">
        <div className="rounded-xl border shadow-sm p-5 bg-card md:col-start-2 w-full">
          <h3 className="text-sm font-semibold mb-3">Alertas e Pontos de Atenção</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                onClick={() => { setOnlyLongLead(true); setShowAllRows(true); }}
                className="w-full flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/40 text-left"
              >
                <span>OS com lead time acima de 30 dias</span>
                <span className="inline-block rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-semibold">
                  {alerts.longLeadCount}
                </span>
              </button>
            </li>
            <li className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground mb-0.5">OS mais antiga concluída</div>
              <div className="text-sm">
                {alerts.oldest
                  ? `${alerts.oldest.code} · aberta ${format(new Date(alerts.oldest.created_at), 'dd/MM')}`
                  : '—'}
              </div>
            </li>
            <li className="rounded-md border px-3 py-2 flex items-center justify-between">
              <span>OS com tempo registrado &lt; 1 min</span>
              <span className="text-xs text-muted-foreground">~{alerts.tinyTime} registros</span>
            </li>
          </ul>
        </div>
      </div>

      {openDialogOS && (
        <DetalheOSDialog
          open={!!openDialogOS}
          onOpenChange={(o) => { if (!o) setOpenDialogOS(null); }}
          workOrder={openDialogOS as any}
          onUpdate={() => { /* read-only context */ }}
        />
      )}


      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando dados…</p>
      )}
    </div>
  );
}
