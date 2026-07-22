import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import {
  Activity, Users, MousePointerClick, AlertTriangle, Loader2,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

type Range = '24h' | '7d' | '30d' | '90d';

const RANGE_HOURS: Record<Range, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
};

type EventRow = {
  id: string;
  occurred_at: string;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  screen: string | null;
  properties: Record<string, unknown>;
  device: Record<string, unknown>;
};

const MODULE_MAP: { label: string; prefixes: string[] }[] = [
  { label: 'Oficina', prefixes: ['/oficina'] },
  { label: 'CRM', prefixes: ['/crm'] },
  { label: 'Preventivas', prefixes: ['/preventivas', '/rotas'] },
  { label: 'Chamados', prefixes: ['/chamados'] },
  { label: 'Pedidos', prefixes: ['/pedidos'] },
  { label: 'Almoxarifado', prefixes: ['/almoxarifado', '/estoque'] },
  { label: 'Admin', prefixes: ['/admin', '/permissoes', '/config'] },
  { label: 'Home', prefixes: ['/home', '/'] },
];

function moduleOf(screen: string | null): string {
  if (!screen) return 'Outros';
  for (const m of MODULE_MAP) {
    for (const p of m.prefixes) {
      if (p === '/' ? screen === '/' : screen.startsWith(p)) return m.label;
    }
  }
  return 'Outros';
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function delta(current: number, previous: number): { pct: number | null; dir: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: current === 0 ? 0 : null, dir: current > 0 ? 'up' : 'flat' };
  const pct = ((current - previous) / previous) * 100;
  return { pct, dir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
}

async function fetchWindow(sinceIso: string, untilIso: string): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('id, occurred_at, user_id, session_id, event_name, screen, properties, device')
    .gte('occurred_at', sinceIso)
    .lt('occurred_at', untilIso)
    .order('occurred_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

export default function AdminAnalytics() {
  const { role } = useAuth();
  const [range, setRange] = useState<Range>('7d');

  const isAllowed =
    role === 'admin' ||
    role === 'coordenador_rplus' ||
    role === 'coordenador_servicos' ||
    role === 'coordenador_logistica';

  const { since, until, prevSince, prevUntil } = useMemo(() => {
    const now = new Date();
    const hours = RANGE_HOURS[range];
    const start = new Date(now.getTime() - hours * 3600_000);
    const prevEnd = start;
    const prevStart = new Date(prevEnd.getTime() - hours * 3600_000);
    return {
      since: start.toISOString(),
      until: now.toISOString(),
      prevSince: prevStart.toISOString(),
      prevUntil: prevEnd.toISOString(),
    };
  }, [range]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-analytics-events', range],
    enabled: isAllowed,
    staleTime: 30_000,
    queryFn: () => fetchWindow(since, until),
  });

  const { data: prevData } = useQuery({
    queryKey: ['admin-analytics-events-prev', range],
    enabled: isAllowed,
    staleTime: 30_000,
    queryFn: () => fetchWindow(prevSince, prevUntil),
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const users = new Set<string>();
    const sessions = new Set<string>();
    const byDay: Record<string, number> = {};
    const usersByDay: Record<string, Set<string>> = {};
    const byEvent: Record<string, number> = {};
    const byScreen: Record<string, number> = {};
    const byModule: Record<string, { events: number; users: Set<string>; sessions: Set<string> }> = {};
    const errors: EventRow[] = [];

    for (const r of rows) {
      if (r.user_id) users.add(r.user_id);
      if (r.session_id) sessions.add(r.session_id);
      const day = fmtDay(r.occurred_at);
      byDay[day] = (byDay[day] ?? 0) + 1;
      if (r.user_id) {
        if (!usersByDay[day]) usersByDay[day] = new Set();
        usersByDay[day].add(r.user_id);
      }
      byEvent[r.event_name] = (byEvent[r.event_name] ?? 0) + 1;
      if (r.event_name === 'screen_viewed' && r.screen) {
        byScreen[r.screen] = (byScreen[r.screen] ?? 0) + 1;
        const m = moduleOf(r.screen);
        if (!byModule[m]) byModule[m] = { events: 0, users: new Set(), sessions: new Set() };
        byModule[m].events += 1;
        if (r.user_id) byModule[m].users.add(r.user_id);
        if (r.session_id) byModule[m].sessions.add(r.session_id);
      }
      if (r.event_name === 'error_shown') errors.push(r);
    }

    const dayKeys = Object.keys(byDay).sort();
    const perDay = dayKeys.map((d) => ({
      day: d.slice(5),
      total: byDay[d],
      usuarios: usersByDay[d]?.size ?? 0,
    }));
    const topScreens = Object.entries(byScreen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([screen, count]) => ({ screen, count }));
    const topEvents = Object.entries(byEvent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));
    const modules = Object.entries(byModule)
      .map(([label, v]) => ({
        label,
        events: v.events,
        users: v.users.size,
        sessions: v.sessions.size,
      }))
      .sort((a, b) => b.events - a.events);

    return {
      total: rows.length,
      users: users.size,
      sessions: sessions.size,
      errorCount: errors.length,
      perDay,
      topScreens,
      topEvents,
      modules,
      recentErrors: errors.slice(0, 20),
    };
  }, [data]);

  const prevStats = useMemo(() => {
    const rows = prevData ?? [];
    const users = new Set<string>();
    const sessions = new Set<string>();
    let errorCount = 0;
    for (const r of rows) {
      if (r.user_id) users.add(r.user_id);
      if (r.session_id) sessions.add(r.session_id);
      if (r.event_name === 'error_shown') errorCount += 1;
    }
    return { total: rows.length, users: users.size, sessions: sessions.size, errorCount };
  }, [prevData]);

  if (!isAllowed) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Você não tem permissão para visualizar analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Uso do app baseado em eventos internos (analytics_events).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d', '90d'] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? 'default' : 'outline'}
              onClick={() => setRange(r)}
            >
              {r}
            </Button>
          ))}
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Erro ao carregar eventos: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* KPIs com comparativo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Eventos" value={stats.total} previous={prevStats.total} icon={Activity} loading={isLoading} />
        <KpiCard title="Usuários únicos" value={stats.users} previous={prevStats.users} icon={Users} loading={isLoading} />
        <KpiCard title="Sessões" value={stats.sessions} previous={prevStats.sessions} icon={MousePointerClick} loading={isLoading} />
        <KpiCard
          title="Erros"
          value={stats.errorCount}
          previous={prevStats.errorCount}
          icon={AlertTriangle}
          loading={isLoading}
          tone={stats.errorCount > 0 ? 'warn' : 'default'}
          invertColors
        />
      </div>

      {/* Eventos + usuários únicos por dia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos e usuários únicos por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : stats.perDay.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.perDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Eventos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="usuarios" name="Usuários únicos (DAU)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Uso por módulo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso por módulo</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : stats.modules.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.modules} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis type="category" dataKey="label" width={100} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="events" name="Visualizações" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="users" name="Usuários" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="text-right">Visualizações</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.modules.map((m) => (
                    <TableRow key={m.label}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.events.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.users.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.sessions.toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top screens */}
        <Card>
          <CardHeader><CardTitle className="text-base">Telas mais visualizadas</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : stats.topScreens.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topScreens} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="screen" width={140} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top events */}
        <Card>
          <CardHeader><CardTitle className="text-base">Tipos de evento</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : stats.topEvents.length === 0 ? (
              <EmptyState />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="text-right">Ocorrências</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topEvents.map((e) => (
                    <TableRow key={e.event}>
                      <TableCell className="font-mono text-xs">{e.event}</TableCell>
                      <TableCell className="text-right">{e.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Erros recentes
            {stats.errorCount > 0 && <Badge variant="destructive">{stats.errorCount}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : stats.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentErrors.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(e.occurred_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-xs">{e.screen ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {String((e.properties as { message?: string })?.message ?? '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title, value, previous, icon: Icon, loading, tone = 'default', invertColors = false,
}: {
  title: string;
  value: number;
  previous?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  tone?: 'default' | 'warn';
  invertColors?: boolean;
}) {
  const d = previous !== undefined ? delta(value, previous) : null;
  const positive = invertColors ? d?.dir === 'down' : d?.dir === 'up';
  const negative = invertColors ? d?.dir === 'up' : d?.dir === 'down';
  const color = positive ? 'text-emerald-600' : negative ? 'text-destructive' : 'text-muted-foreground';
  const DeltaIcon = d?.dir === 'up' ? TrendingUp : d?.dir === 'down' ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{title}</span>
          <Icon className={`h-4 w-4 ${tone === 'warn' ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {value.toLocaleString('pt-BR')}
            </div>
            {d && (
              <div className={`mt-1 flex items-center gap-1 text-xs ${color}`}>
                <DeltaIcon className="h-3 w-3" />
                <span className="tabular-nums">
                  {d.pct === null ? '—' : `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%`}
                </span>
                <span className="text-muted-foreground">vs período anterior ({(previous ?? 0).toLocaleString('pt-BR')})</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem dados para o período.
    </div>
  );
}
