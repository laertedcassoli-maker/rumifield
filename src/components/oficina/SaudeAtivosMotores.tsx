import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
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
  workshop_item_id: string | null;
  old_motor_code: string | null;
  new_motor_code: string | null;
  motor_hours_used: number | null;
  replaced_at: string | null;
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
      const { data, error } = await supabase
        .from('motor_replacement_history')
        .select('workshop_item_id, old_motor_code, new_motor_code, motor_hours_used, replaced_at')
        .order('replaced_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as MotorHistoryRow[];
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
                        {r.hoursSinceReplacement!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                      </td>
                      <td className="py-2">{badgeForHours(r.hoursSinceReplacement!)}</td>
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
          <CardTitle className="text-base">Últimas trocas de motor</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma troca registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-2">Ativo</th>
                    <th className="py-2 pr-2">Motor anterior → novo</th>
                    <th className="py-2 pr-2 text-right">Horas de uso</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => {
                    const item = h.workshop_item_id ? itemsById.get(h.workshop_item_id) : null;
                    return (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-medium">{item?.unique_code || '—'}</td>
                        <td className="py-2 pr-2">
                          {(h.old_motor_code || '—')} → {(h.new_motor_code || '—')}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {h.motor_hours_used != null
                            ? `${Number(h.motor_hours_used).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
                            : '—'}
                        </td>
                        <td className="py-2">
                          {h.replaced_at ? format(new Date(h.replaced_at), 'dd/MM/yyyy') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
