import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCarteiraData, PRODUCT_ORDER, PRODUCT_LABELS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { subDays, parseISO } from 'date-fns';

const QUALIFIED_STAGES: CrmStage[] = ['qualificado', 'proposta', 'negociacao', 'ganho'];

export default function CrmDashboard() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'coordenador_rplus';
  const { clientes, clientProducts, actions, isLoading } = useCarteiraData();
  const [selectedConsultor, setSelectedConsultor] = useState<string>('all');

  // Fetch consultores for admin filter
  const { data: consultores } = useQuery({
    queryKey: ['crm-consultores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch completed visits in last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const { data: completedVisits, isLoading: loadingVisits } = useQuery({
    queryKey: ['crm-dashboard-visits-30d'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_visits')
        .select('id, client_id, checkout_at, owner_user_id')
        .eq('status', 'concluida')
        .gte('checkout_at', thirtyDaysAgo);
      if (error) throw error;
      return data as { id: string; client_id: string; checkout_at: string; owner_user_id: string }[];
    },
    enabled: !!user,
  });

  // Filtered data based on selected consultant
  const filteredClientes = useMemo(() => {
    if (!isAdmin || selectedConsultor === 'all') return clientes;
    return clientes.filter(c => c.consultor_rplus_id === selectedConsultor);
  }, [clientes, selectedConsultor, isAdmin]);

  const filteredClientIds = useMemo(() => new Set(filteredClientes.map(c => c.id)), [filteredClientes]);

  const filteredProducts = useMemo(() => {
    return clientProducts.filter((p: any) => filteredClientIds.has(p.client_id));
  }, [clientProducts, filteredClientIds]);

  const filteredActions = useMemo(() => {
    return actions.filter((a: any) => filteredClientIds.has(a.client_id));
  }, [actions, filteredClientIds]);

  const filteredVisits30d = useMemo(() => {
    if (!completedVisits) return [];
    return completedVisits.filter(v => filteredClientIds.has(v.client_id));
  }, [completedVisits, filteredClientIds]);

  // KPI calculations
  const totalClientes = filteredClientes.length;

  const visitCoverage = useMemo(() => {
    if (totalClientes === 0) return 0;
    const visitedClientIds = new Set(filteredVisits30d.map(v => v.client_id));
    return Math.round((visitedClientIds.size / totalClientes) * 100);
  }, [filteredVisits30d, totalClientes]);

  const pendingActions = useMemo(() => {
    return filteredActions.filter((a: any) => a.status !== 'concluida' && a.status !== 'cancelada').length;
  }, [filteredActions]);

  const overdueActions = useMemo(() => {
    const now = new Date();
    return filteredActions.filter((a: any) => {
      if (a.status === 'concluida' || a.status === 'cancelada') return false;
      if (!a.due_at) return false;
      return parseISO(a.due_at) < now;
    }).length;
  }, [filteredActions]);

  // Product metrics
  const productMetrics = useMemo(() => {
    return PRODUCT_ORDER.map(code => {
      const productsForCode = filteredProducts.filter((p: any) => p.product_code === code);
      const total = totalClientes;
      const activated = productsForCode.filter((p: any) => p.stage === 'ganho').length;
      const qualified = productsForCode.filter((p: any) => QUALIFIED_STAGES.includes(p.stage as CrmStage)).length;

      return {
        code,
        label: PRODUCT_LABELS[code],
        activationPct: total > 0 ? Math.round((activated / total) * 100) : 0,
        activationCount: activated,
        qualificationPct: total > 0 ? Math.round((qualified / total) * 100) : 0,
        qualificationCount: qualified,
        total,
      };
    });
  }, [filteredProducts, totalClientes]);

  const loading = isLoading || loadingVisits;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">Minha Carteira</h1>
        {isAdmin && consultores && consultores.length > 0 && (
          <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os consultores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {consultores.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={Users} label="Clientes Ativos" value={totalClientes} />
          <SummaryCard icon={CalendarCheck} label="Cobertura 30d" value={`${visitCoverage}%`} sub={`${new Set(filteredVisits30d.map(v => v.client_id)).size} visitados`} />
          <SummaryCard icon={Clock} label="Ações Pendentes" value={pendingActions} />
          <SummaryCard icon={AlertTriangle} label="Ações Vencidas" value={overdueActions} variant={overdueActions > 0 ? 'danger' : 'default'} />
        </div>
      )}

      {/* Activation by Product */}
      {loading ? (
        <Skeleton className="h-60 rounded-lg" />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ativação por Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productMetrics.map(m => (
              <ProductBar key={m.code} label={m.label} pct={m.activationPct} count={m.activationCount} total={m.total} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Qualification by Product */}
      {loading ? (
        <Skeleton className="h-60 rounded-lg" />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Qualificação por Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productMetrics.map(m => (
              <ProductBar key={m.code} label={m.label} pct={m.qualificationPct} count={m.qualificationCount} total={m.total} variant="qualification" />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, variant = 'default' }: {
  icon: any; label: string; value: string | number; sub?: string; variant?: 'default' | 'danger';
}) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${variant === 'danger' ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className={`text-2xl font-bold ${variant === 'danger' ? 'text-destructive' : 'text-foreground'}`}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  );
}

function ProductBar({ label, pct, count, total, variant = 'activation' }: {
  label: string; pct: number; count: number; total: number; variant?: 'activation' | 'qualification';
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count}/{total} ({pct}%)</span>
      </div>
      <Progress value={pct} className={`h-2.5 ${variant === 'qualification' ? '[&>div]:bg-blue-500' : ''}`} />
    </div>
  );
}
