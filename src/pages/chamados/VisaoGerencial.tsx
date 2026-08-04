import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  differenceInMinutes,
  differenceInCalendarDays,
  startOfMonth,
  subMonths,
  subDays,
  endOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/gerencial/KPICard';
import { FunnelChart } from '@/components/gerencial/FunnelChart';
import { RankingBar } from '@/components/gerencial/RankingBar';
import { FilterBarChamados, type ChamadosFilters } from '@/components/gerencial/FilterBarChamados';
import { useFieldTechnicians, presets } from '@/components/gerencial/filterBarShared';
import { fetchChamadosDataset, fetchVolumeChamados, type ChamadosParams } from '@/lib/queries/chamadosGerencial';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const OPEN_STATUSES = ['aberto', 'em_atendimento', 'aguardando_peca'];

function formatDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}min`;
}

export default function VisaoGerencialChamados() {
  const [filters, setFilters] = useState<ChamadosFilters>(() => ({
    dateRange: presets.trimestreAtual(),
    selectedTecnicos: [],
    selectedPriority: null,
  }));
  const [volumeMode, setVolumeMode] = useState<'mes' | 'dia'>('mes');

  const { data: technicians = [] } = useFieldTechnicians();
  const techName = (id: string) => technicians.find((t) => t.id === id)?.nome ?? 'Não atribuído';

  const params: ChamadosParams | null = useMemo(() => {
    const f = filters.dateRange?.from;
    if (!f) return null;
    const t = filters.dateRange?.to ?? f;
    return {
      from: fmt(f),
      to: fmt(t),
      tecnicoIds: filters.selectedTecnicos,
      priority: filters.selectedPriority,
    };
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['chamados-ger-dataset', params],
    queryFn: () => fetchChamadosDataset(params!),
    enabled: Boolean(params),
  });

  const volumeRange = useMemo(() => {
    const today = new Date();
    return volumeMode === 'mes'
      ? { from: fmt(startOfMonth(subMonths(today, 5))), to: fmt(endOfMonth(today)) }
      : { from: fmt(subDays(today, 13)), to: fmt(today) };
  }, [volumeMode]);

  const { data: volumeRows = [] } = useQuery({
    queryKey: ['chamados-ger-volume', volumeRange, params?.tecnicoIds, params?.priority],
    queryFn: () =>
      fetchVolumeChamados(volumeRange, {
        tecnicoIds: params!.tecnicoIds,
        priority: params!.priority,
      }),
    enabled: Boolean(params),
  });

  const volumeData = useMemo(() => {
    const counts = new Map<string, number>();
    const today = new Date();
    if (volumeMode === 'mes') {
      for (let i = 5; i >= 0; i--) {
        const d = startOfMonth(subMonths(today, i));
        counts.set(format(d, 'yyyy-MM'), 0);
      }
      for (const r of volumeRows) {
        const key = format(new Date(r.created_at), 'yyyy-MM');
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].map(([key, count]) => ({
        label: format(new Date(`${key}-01T00:00:00`), 'MMM/yy', { locale: ptBR }),
        chamados: count,
      }));
    }
    for (let i = 13; i >= 0; i--) counts.set(fmt(subDays(today, i)), 0);
    for (const r of volumeRows) {
      const key = format(new Date(r.created_at), 'yyyy-MM-dd');
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => ({
      label: format(new Date(`${key}T00:00:00`), 'dd/MM', { locale: ptBR }),
      chamados: count,
    }));
  }, [volumeRows, volumeMode]);

  const derived = useMemo(() => {
    const tickets = data?.tickets ?? [];
    const visitsByTicket = data?.visitsByTicket ?? {};
    const tagsByTicket = data?.tagsByTicket ?? {};
    const clientNames = data?.clientNames ?? {};
    const categoryNames = data?.categoryNames ?? {};

    const total = tickets.length;
    const dias = params ? differenceInCalendarDays(new Date(`${params.to}T00:00:00`), new Date(`${params.from}T00:00:00`)) + 1 : 1;

    const comVisita = tickets.filter((t) => (visitsByTicket[t.id]?.length ?? 0) > 0);
    const resolvidos = tickets.filter((t) => t.status === 'resolvido' && t.resolved_at);
    const remotos = resolvidos.filter((t) => (visitsByTicket[t.id]?.length ?? 0) === 0);

    const tempos = resolvidos.map((t) => differenceInMinutes(new Date(t.resolved_at!), new Date(t.created_at)));
    const tempoMedio = tempos.length ? tempos.reduce((s, v) => s + v, 0) / tempos.length : null;

    const abertos = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
    const now = new Date();
    const antigos = abertos
      .map((t) => ({ ...t, idade: differenceInCalendarDays(now, new Date(t.created_at)) }))
      .sort((a, b) => b.idade - a.idade);
    const antigos5 = antigos.filter((t) => t.idade > 5);

    const funnel = [
      { label: 'Abertos', count: tickets.filter((t) => t.status === 'aberto').length, color: 'text-blue-600 dark:text-blue-400' },
      { label: 'Em atendimento', count: tickets.filter((t) => t.status === 'em_atendimento').length, color: 'text-amber-600 dark:text-amber-400' },
      { label: 'Aguardando peça', count: tickets.filter((t) => t.status === 'aguardando_peca').length, color: 'text-red-600 dark:text-red-400' },
      { label: 'Resolvidos', count: tickets.filter((t) => t.status === 'resolvido').length, color: 'text-green-600 dark:text-green-400' },
    ];

    // Ranking de motivos: tags de causa, com fallback para a categoria do chamado
    const motivos = new Map<string, number>();
    for (const t of tickets) {
      const tags = tagsByTicket[t.id];
      if (tags?.length) {
        for (const tag of tags) motivos.set(tag, (motivos.get(tag) ?? 0) + 1);
      } else if (t.category_id && categoryNames[t.category_id]) {
        const name = categoryNames[t.category_id];
        motivos.set(name, (motivos.get(name) ?? 0) + 1);
      } else {
        motivos.set('Sem classificação', (motivos.get('Sem classificação') ?? 0) + 1);
      }
    }
    const topMotivos = [...motivos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, barColor: 'bg-amber-500' }));

    // Ranking de clientes recorrentes
    const porCliente = new Map<string, number>();
    for (const t of tickets) {
      const name = (t.client_id && clientNames[t.client_id]) || 'Sem cliente';
      porCliente.set(name, (porCliente.get(name) ?? 0) + 1);
    }
    const topClientes = [...porCliente.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, barColor: 'bg-blue-600' }));

    // Produtividade por técnico
    const byTech = new Map<
      string,
      { total: number; resolvidos: number; comVisita: number; tempos: number[]; abertos: number }
    >();
    for (const t of tickets) {
      const key = t.assigned_technician_id ?? 'sem_tecnico';
      const entry = byTech.get(key) ?? { total: 0, resolvidos: 0, comVisita: 0, tempos: [], abertos: 0 };
      entry.total += 1;
      if ((visitsByTicket[t.id]?.length ?? 0) > 0) entry.comVisita += 1;
      if (t.status === 'resolvido' && t.resolved_at) {
        entry.resolvidos += 1;
        entry.tempos.push(differenceInMinutes(new Date(t.resolved_at), new Date(t.created_at)));
      }
      if (OPEN_STATUSES.includes(t.status)) entry.abertos += 1;
      byTech.set(key, entry);
    }
    const produtividade = [...byTech.entries()]
      .map(([id, v]) => ({
        id,
        nome: id === 'sem_tecnico' ? 'Não atribuído' : techName(id),
        total: v.total,
        resolvidos: v.resolvidos,
        abertos: v.abertos,
        pctRemoto: v.total > 0 ? Math.round(((v.total - v.comVisita) / v.total) * 100) : 0,
        tempoMedio: v.tempos.length ? v.tempos.reduce((s, x) => s + x, 0) / v.tempos.length : null,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      total,
      mediaDia: dias > 0 ? total / dias : 0,
      tempoMedio,
      pctRemoto: total > 0 ? Math.round((remotos.length / total) * 100) : 0,
      remotos: remotos.length,
      pctVisita: total > 0 ? Math.round((comVisita.length / total) * 100) : 0,
      comVisita: comVisita.length,
      antigos5: antigos5.length,
      maisAntigo: antigos[0]?.idade ?? 0,
      resolvidos: resolvidos.length,
      funnel,
      topMotivos,
      topClientes,
      produtividade,
      antigosLista: antigos.slice(0, 10).map((t) => ({
        id: t.id,
        code: t.ticket_code,
        title: t.title,
        cliente: (t.client_id && clientNames[t.client_id]) || 'Sem cliente',
        tecnico: t.assigned_technician_id ? techName(t.assigned_technician_id) : 'Não atribuído',
        status: t.status,
        idade: t.idade,
      })),
    };
  }, [data, params, technicians]);

  const donutData = useMemo(
    () => [
      { name: 'Resolvido remoto', value: derived.remotos, fill: 'hsl(142 71% 45%)' },
      { name: 'Visita corretiva', value: derived.comVisita, fill: 'hsl(271 76% 53%)' },
    ],
    [derived],
  );
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  const periodoLabel = params
    ? `${format(new Date(`${params.from}T00:00:00`), 'dd MMM yyyy', { locale: ptBR })} — ${format(new Date(`${params.to}T00:00:00`), 'dd MMM yyyy', { locale: ptBR })}`
    : 'Período não definido';

  const statusLabels: Record<string, string> = {
    aberto: 'Aberto',
    em_atendimento: 'Em atendimento',
    aguardando_peca: 'Aguardando peça',
    resolvido: 'Resolvido',
    cancelado: 'Cancelado',
  };

  return (
    <div className="p-4 md:p-6 animate-fade-in" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Chamados &amp; Visitas Corretivas · Visão Gerencial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Volume, tempo de atendimento, resolução remota e produtividade dos técnicos · {periodoLabel}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <FilterBarChamados defaultPreset="trimestre" onFilterChange={setFilters} />
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
            label="Total de chamados"
            value={String(derived.total)}
            subtext={`${derived.mediaDia.toFixed(1)} por dia em média`}
            iconType="info"
          />
          <KPICard
            label="Tempo médio de atendimento"
            value={formatDuration(derived.tempoMedio)}
            subtext={`${derived.resolvidos} chamados resolvidos`}
            iconType="warning"
          />
          <KPICard
            label="% Resolvido remoto"
            value={`${derived.pctRemoto}%`}
            subtext={`${derived.remotos}/${derived.total} sem visita corretiva`}
            iconType="success"
          />
          <KPICard
            label="% Virou visita corretiva"
            value={`${derived.pctVisita}%`}
            subtext={`${derived.comVisita}/${derived.total} com visita CORR`}
            iconType="purple"
          />
          <KPICard
            label="Abertos há > 5 dias"
            value={String(derived.antigos5)}
            subtext={`Mais antigo com ${derived.maisAntigo} dias`}
            iconType="critical"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm font-semibold min-w-0 truncate">Volume de chamados</CardTitle>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant={volumeMode === 'mes' ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setVolumeMode('mes')}
              >
                Por mês
              </Button>
              <Button
                size="sm"
                variant={volumeMode === 'dia' ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setVolumeMode('dia')}
              >
                Por dia
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
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
                    dataKey="chamados"
                    name="Chamados"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {volumeMode === 'mes' ? 'Últimos 6 meses' : 'Últimos 14 dias'} · respeita técnico e prioridade
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Remoto vs. visita corretiva</CardTitle>
          </CardHeader>
          <CardContent>
            {donutTotal === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhum chamado no período.</p>
            ) : (
              <div className="flex items-center gap-5">
                <div style={{ width: 118, height: 118 }} className="shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        innerRadius={36}
                        outerRadius={56}
                        paddingAngle={2}
                        stroke="none"
                        animationDuration={700}
                      >
                        {donutData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 min-w-0">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-xs text-muted-foreground truncate min-w-0">{d.name}</span>
                      <span className="text-xs font-bold font-mono shrink-0">
                        {Math.round((d.value / donutTotal) * 100)}% ({d.value})
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Base: {derived.total} chamados · {derived.total - donutTotal} ainda sem desfecho
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Funil de status dos chamados</CardTitle>
        </CardHeader>
        <CardContent>
          <FunnelChart steps={derived.funnel} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Principais motivos</CardTitle>
          </CardHeader>
          <CardContent>
            {derived.topMotivos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhum chamado no período.</p>
            ) : (
              <RankingBar items={derived.topMotivos} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Clientes com mais chamados</CardTitle>
          </CardHeader>
          <CardContent>
            {derived.topClientes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhum chamado no período.</p>
            ) : (
              <RankingBar items={derived.topClientes} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Produtividade por técnico</CardTitle>
        </CardHeader>
        <CardContent>
          {derived.produtividade.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhum chamado no período filtrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: '12.5px' }}>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Técnico</th>
                    <th className="py-2 pr-3 font-medium text-right">Chamados</th>
                    <th className="py-2 pr-3 font-medium text-right">Resolvidos</th>
                    <th className="py-2 pr-3 font-medium text-right">Em aberto</th>
                    <th className="py-2 pr-3 font-medium text-right">% Remoto</th>
                    <th className="py-2 font-medium text-right">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.produtividade.map((t) => (
                    <tr key={t.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 min-w-0 truncate">{t.nome}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.total}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.resolvidos}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.abertos}</td>
                      <td className="py-2 pr-3 text-right font-mono">{t.pctRemoto}%</td>
                      <td className="py-2 text-right font-mono">{formatDuration(t.tempoMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Chamados mais antigos em aberto</CardTitle>
        </CardHeader>
        <CardContent>
          {derived.antigosLista.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhum chamado em aberto no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: '12.5px' }}>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Chamado</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Técnico</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Idade</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.antigosLista.map((t) => (
                    <tr key={t.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 min-w-0">
                        <span className="font-mono">{t.code}</span>
                        <span className="text-muted-foreground"> · {t.title}</span>
                      </td>
                      <td className="py-2 pr-3 min-w-0 truncate">{t.cliente}</td>
                      <td className="py-2 pr-3 min-w-0 truncate">{t.tecnico}</td>
                      <td className="py-2 pr-3">{statusLabels[t.status] ?? t.status}</td>
                      <td
                        className={
                          t.idade > 5
                            ? 'py-2 text-right font-mono font-bold text-red-600 dark:text-red-400'
                            : 'py-2 text-right font-mono'
                        }
                      >
                        {t.idade}d
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
