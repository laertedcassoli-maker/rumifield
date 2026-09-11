import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Ajustáveis
const LIMIAR_ALERTA_LARANJA = 1000;
const LIMIAR_ALERTA_VERMELHO = 1500;

interface WorkshopItemRow {
  id: string;
  unique_code: string | null;
  current_motor_code: string | null;
  meter_hours_last: number | null;
  meter_hours_updated_at: string | null;
  motor_replaced_at_meter_hours: number | null;
  status: string | null;
}

interface MotorHistoryRow {
  id: string;
  workshop_item_id: string | null;
  old_motor_code: string | null;
  new_motor_code: string | null;
  motor_hours_used: number | null;
  replaced_at: string | null;
  was_original_motor: boolean | null;
}

function badgeForHours(hours: number) {
  if (hours >= LIMIAR_ALERTA_VERMELHO) {
    return <Badge className="bg-red-600 hover:bg-red-600 text-white">Crítico</Badge>;
  }
  if (hours >= LIMIAR_ALERTA_LARANJA) {
    return <Badge className="bg-orange-500 hover:bg-orange-500 text-white">Atenção</Badge>;
  }
  return <Badge variant="secondary">Ok</Badge>;
}

export function SaudeAtivosMotores() {
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['gestao-os-saude-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_items')
        .select('id, unique_code, current_motor_code, meter_hours_last, meter_hours_updated_at, motor_replaced_at_meter_hours, status');
      if (error) throw error;
      return (data || []) as WorkshopItemRow[];
    },
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['gestao-os-motor-history'],
    queryFn: async () => {
      const pageSize = 1000;
      const allRows: MotorHistoryRow[] = [];

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('motor_replacement_history')
          .select('id, workshop_item_id, old_motor_code, new_motor_code, motor_hours_used, replaced_at, was_original_motor')
          .order('replaced_at', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;

        const page = (data || []) as MotorHistoryRow[];
        allRows.push(...page);
        if (page.length < pageSize) break;
      }

      return allRows;
    },
  });

  const rows = useMemo(() => {
    return items
      .map(it => {
        const hours = (it.meter_hours_last != null && it.motor_replaced_at_meter_hours != null)
          ? Number(it.meter_hours_last) - Number(it.motor_replaced_at_meter_hours)
          : null;
        return { ...it, hoursSinceReplacement: hours };
      })
      .filter(r => r.hoursSinceReplacement != null && r.hoursSinceReplacement >= 0)
      .sort((a, b) => (b.hoursSinceReplacement ?? 0) - (a.hoursSinceReplacement ?? 0));
  }, [items]);

  const itemsById = useMemo(() => {
    const m = new Map<string, WorkshopItemRow>();
    items.forEach(it => m.set(it.id, it));
    return m;
  }, [items]);

  const motorLifetime = useMemo(() => {
    type Cycle = {
      workshopItemId: string;
      hours: number;
      days: number | null;
    };

    const historyByItem = new Map<string, MotorHistoryRow[]>();

    history.forEach(entry => {
      if (!entry.workshop_item_id) return;
      const entries = historyByItem.get(entry.workshop_item_id) || [];
      entries.push(entry);
      historyByItem.set(entry.workshop_item_id, entries);
    });

    const cycles: Cycle[] = [];
    historyByItem.forEach((entries, workshopItemId) => {
      const ordered = [...entries].sort(
        (a, b) => new Date(a.replaced_at || 0).getTime() - new Date(b.replaced_at || 0).getTime(),
      );

      ordered.forEach((removal, index) => {
        if (!removal.replaced_at || removal.motor_hours_used == null) return;

        const hours = Number(removal.motor_hours_used);
        if (!Number.isFinite(hours) || hours < 0) return;

        if (index === 0) {
          // Primeira troca: só entra quando confirmada como motor original na OS.
          // Sem data de instalação conhecida, contribui apenas com horas.
          if (removal.was_original_motor === true) {
            cycles.push({ workshopItemId, hours, days: null });
          }
          return;
        }

        const installation = ordered[index - 1];
        if (!installation.replaced_at) return;

        const days = differenceInCalendarDays(new Date(removal.replaced_at), new Date(installation.replaced_at));
        cycles.push({ workshopItemId, hours, days: days >= 0 ? days : null });
      });
    });

    const byItem = new Map<string, { count: number; totalHours: number; totalDays: number; daysCount: number }>();
    cycles.forEach(cycle => {
      const aggregate = byItem.get(cycle.workshopItemId) || { count: 0, totalHours: 0, totalDays: 0, daysCount: 0 };
      aggregate.count += 1;
      aggregate.totalHours += cycle.hours;
      if (cycle.days != null) {
        aggregate.totalDays += cycle.days;
        aggregate.daysCount += 1;
      }
      byItem.set(cycle.workshopItemId, aggregate);
    });

    const rowsByItem = Array.from(byItem.entries())
      .map(([workshopItemId, aggregate]) => ({
        workshopItemId,
        assetCode: itemsById.get(workshopItemId)?.unique_code || '—',
        cycleCount: aggregate.count,
        averageHours: aggregate.totalHours / aggregate.count,
        averageDays: aggregate.daysCount > 0 ? aggregate.totalDays / aggregate.daysCount : null,
      }))
      .sort((a, b) => b.averageHours - a.averageHours || a.assetCode.localeCompare(b.assetCode));

    const totalHours = cycles.reduce((sum, cycle) => sum + cycle.hours, 0);
    const cyclesWithDays = cycles.filter(cycle => cycle.days != null);
    const totalDays = cyclesWithDays.reduce((sum, cycle) => sum + (cycle.days ?? 0), 0);

    return {
      cycleCount: cycles.length,
      averageHours: cycles.length > 0 ? totalHours / cycles.length : 0,
      averageDays: cyclesWithDays.length > 0 ? totalDays / cyclesWithDays.length : null,
      daysCycleCount: cyclesWithDays.length,
      rowsByItem,
    };
  }, [history, itemsById]);


  const formatAverage = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativos com motor há mais tempo em uso</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de horímetro/troca de motor.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-2">Ativo</th>
                    <th className="py-2 pr-2">Motor atual</th>
                    <th className="py-2 pr-2 text-right">Horas desde troca</th>
                    <th className="py-2">Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{r.unique_code || '—'}</td>
                      <td className="py-2 pr-2">{r.current_motor_code || '—'}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {Number(r.hoursSinceReplacement).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                      </td>
                      <td className="py-2">{badgeForHours(Number(r.hoursSinceReplacement))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tempo médio de vida útil do motor</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : motorLifetime.cycleCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem ciclos completos: é necessário ao menos duas trocas de motor no mesmo ativo, ou uma troca marcada como
              "Motor original?" na OS.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b pb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Média em horas</p>
                  <p className="text-xl font-semibold tabular-nums">{formatAverage(motorLifetime.averageHours)} h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média em dias</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {motorLifetime.averageDays != null ? `${formatAverage(motorLifetime.averageDays)} dias` : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {motorLifetime.daysCycleCount} troca(s) com data de instalação conhecida
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ciclos completos</p>
                  <p className="text-xl font-semibold tabular-nums">{motorLifetime.cycleCount}</p>
                </div>
              </div>


              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-2">Ativo</th>
                      <th className="py-2 pr-2 text-right">Trocas</th>
                      <th className="py-2 pr-2 text-right">Média em horas</th>
                      <th className="py-2 text-right">Média em dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motorLifetime.rowsByItem.map(row => (
                      <tr key={row.workshopItemId} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-medium">{row.assetCode}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{row.cycleCount}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatAverage(row.averageHours)} h</td>
                        <td className="py-2 text-right tabular-nums">
                          {row.averageDays != null ? `${formatAverage(row.averageDays)} dias` : '—'}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
