import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from '@/components/gerencial/KPICard';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format } from 'date-fns';

export default function GestaoPreventivas() {
  const since = useMemo(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'), []);

  const { data, isLoading } = useQuery({
    queryKey: ['gestao-preventivas-90d', since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_maintenance')
        .select('id, client_id, status, scheduled_date, completed_date')
        .gte('scheduled_date', since);
      if (error) throw error;
      return data;
    },
  });

  const kpis = useMemo(() => {
    const rows = data ?? [];
    const total = rows.length;
    const concluidas = rows.filter(r => r.status === 'concluida').length;
    const today = format(new Date(), 'yyyy-MM-dd');
    const atrasadas = rows.filter(r => r.status !== 'concluida' && r.scheduled_date < today).length;
    const planejadas = total - concluidas - atrasadas;
    const clientes = new Set(rows.map(r => r.client_id)).size;
    const clientesConcluidos = new Set(rows.filter(r => r.status === 'concluida').map(r => r.client_id)).size;
    const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');
    return { total, concluidas, atrasadas, planejadas, clientes, clientesConcluidos, pct };
  }, [data]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground">Gestão de Preventivas</h1>
        <p className="text-sm text-muted-foreground mt-1">Indicadores das manutenções preventivas nos últimos 90 dias</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Concluídas"
            value={kpis.pct(kpis.concluidas)}
            subtext={`${kpis.concluidas} de ${kpis.total} preventivas`}
            iconType="success"
          />
          <KPICard
            label="Atrasadas"
            value={String(kpis.atrasadas)}
            subtext="Data planejada já vencida"
            iconType={kpis.atrasadas > 0 ? 'critical' : 'success'}
          />
          <KPICard
            label="Planejadas"
            value={String(kpis.planejadas)}
            subtext="Ainda dentro do prazo"
            iconType="info"
          />
          <KPICard
            label="Cobertura de clientes"
            value={kpis.clientes > 0 ? `${Math.round((kpis.clientesConcluidos / kpis.clientes) * 100)}%` : '0%'}
            subtext={`${kpis.clientesConcluidos} de ${kpis.clientes} fazendas atendidas`}
            iconType="purple"
          />
        </div>
      )}
    </div>
  );
}
