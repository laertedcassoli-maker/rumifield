import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wrench } from 'lucide-react';
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

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando dados…</p>
      )}
    </div>
  );
}
