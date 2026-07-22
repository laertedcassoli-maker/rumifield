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
import { Activity, Users, MousePointerClick, AlertTriangle, Loader2 } from 'lucide-react';

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

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminAnalytics() {
  const { role } = useAuth();
  const [range, setRange] = useState<Range>('7d');

  const isAllowed =
    role === 'admin' ||
    role === 'coordenador_rplus' ||
    role === 'coordenador_servicos' ||
    role === 'coordenador_logistica';

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - RANGE_HOURS[range]);
    return d.toISOString();
  }, [range]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-analytics-events', range],
    enabled: isAllowed,
    staleTime: 30_000,
    queryFn: async () => {
      // Cap to avoid runaway payloads. Increase if needed later.
      const { data, error } = await supabase
        .from('analytics_events')
        .select('id, occurred_at, user_id, session_id, event_name, screen, properties, device')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as EventRow[];
    },
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const users = new Set<string>();
    const sessions = new Set<string>();
    const byDay: Record<string, number> = {};
    const byEvent: Record<string, number> = {};
    const byScreen: Record<string, number> = {};
    const errors: EventRow[] = [];

    for (const r of rows) {
      if (r.user_id) users.add(r.user_id);
      if (r.session_id) sessions.add(r.session_id);
      const day = fmtDay(r.occurred_at);
      byDay[day] = (byDay[day] ?? 0) + 1;
      byEvent[r.event_name] = (byEvent[r.event_name] ?? 0) + 1;
      if (r.event_name === 'screen_viewed' && r.screen) {
        byScreen[r.screen] = (byScreen[r.screen] ?? 0) + 1;
      }
      if (r.event_name === 'error_shown') {
        errors.push(r);
      }
    }

    const dayKeys = Object.keys(byDay).sort();
    const perDay = dayKeys.map((d) => ({ day: d.slice(5), total: byDay[d] }));
    const topScreens = Object.entries(byScreen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([screen, count]) => ({ screen, count }));
    const topEvents = Object.entries(byEvent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));

    return {
      total: rows.length,
      users: users.size,
      sessions: sessions.size,
      errorCount: errors.length,
      perDay,
      topScreens,
      topEvents,
      recentErrors: errors.slice(0, 20),
    };
  }, [data]);

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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Eventos" value={stats.total} icon={Activity} loading={isLoading} />
        <KpiCard title="Usuários únicos" value={stats.users} icon={Users} loading={isLoading} />
        <KpiCard title="Sessões" value={stats.sessions} icon={MousePointerClick} loading={isLoading} />
        <KpiCard
          title="Erros"
          value={stats.errorCount}
          icon={AlertTriangle}
          loading={isLoading}
          tone={stats.errorCount > 0 ? 'warn' : 'default'}
        />
      </div>

      {/* Events per day */}
      <Card>
        <CardHeader><CardTitle className="text-base">Eventos por dia</CardTitle></CardHeader>
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
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
  title, value, icon: Icon, loading, tone = 'default',
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  tone?: 'default' | 'warn';
}) {
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
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {value.toLocaleString('pt-BR')}
          </div>
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
